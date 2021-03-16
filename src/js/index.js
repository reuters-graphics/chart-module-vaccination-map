import 'd3-transition';

import { appendSelect } from 'd3-appendselect';
import merge from 'lodash/merge';
import * as topojson from 'topojson-client';
import AtlasMetadataClient from '@reuters-graphics/graphics-atlas-client';
import * as d3 from 'd3';
// import { geoVoronoi } from 'd3-geo-voronoi';

d3.selection.prototype.appendSelect = appendSelect;

/**
 * Write your chart as a class with a single draw method that draws
 * your chart! This component inherits from a base class you can
 * see and customize in the baseClasses folder.
 */
class VaccineMap {
  selection(selector) {
    if (!selector) return this._selection;
    this._selection = d3.select(selector);
    return this;
  }

  data(newData) {
    if (!newData) return this._data || this.defaultData;
    this._data = newData;
    return this;
  }

  props(newProps) {
    if (!newProps) return this._props || this.defaultProps;
    this._props = merge(this._props || this.defaultProps, newProps);
    return this;
  }

  geo(newGeo) {
    if (!newGeo) return this._geo || this.defaultGeo;
    this._geo = newGeo;
    return this;
  }

  /**
   * Default data for your chart. Generally, it's NOT a good idea to import
   * a big dataset and assign it here b/c it'll make your component quite
   * large in terms of file size. At minimum, though, you should assign an
   * empty Array or Object, depending on what your chart expects.
   */
  defaultData = [
    { x: 0, y: 0, r: 1 },
    { x: 10, y: 35, r: 5 },
    { x: 40, y: 30, r: 10 },
    { x: 70, y: 70, r: 15 },
  ];

  /**
   * Default props are the built-in styles your chart comes with
   * that you want to allow a user to customize. Remember, you can
   * pass in complex data here, like default d3 axes or accessor
   * functions that can get properties from your data.
   */
  defaultProps = {
    heightRatio: (width, breakpoint) => (width < breakpoint ? 0.8 : 0.5),
    locale: 'en',
    getDataRange: (width) => ({ min: 0, max: 1 }),
    borders: {
      strokeColor: '#2f353f',
      strokeWidth: 0.5,
      disputedBorders: {
        show: false,
        strokeColor: '#2f353f',
        strokeWidth: 0.5,
        dasharray: [5, 5],
      },
    },
    globe: {
      strokeColor: 'rgba(255, 255, 255, 0.5)',
      strokeWidth: 0.1,
      landFill: 'rgba(153,153,153,0.25)',
      verticalAxisTilt: 15,
      colorFill: '#22BD3B'
    },
    interaction: true,
    variableName: 'perPopulation',
    spin: true,
    spinSpeed: 12000,
    spinToSpeed: 750,
    topology: {
      getCountryFeatures: (topology) => topology.objects.countries,
      getIsoAlpha3Property: (properties) => properties.isoAlpha3,
      getDisputedBorderFeatures: (topology) => topology.objects.disputedBoundaries,
      getLandFeatures: (topology) => topology.objects.land,
    },

  };

  _rotation = [0, 0];

  _drawSphere() {
    const { globe } = this.props();
    this._context.beginPath();
    this._path({ type: 'Sphere' });
    this._context.strokeStyle = globe.strokeColor;
    this._context.lineWidth = globe.strokeWidth;
    this._context.stroke();
  }
  
  _drawLand() {
    const { globe } = this.props();
    this._context.beginPath();
    this._path(this._land);
    this._context.fillStyle = globe.landFill;
    this._context.fill();
  }

  _drawBorders() {
    const { borders } = this.props();
    if (borders.disputedBorders.show) this._drawDisputedBorders();
  }

  _drawDisputedBorders() {
    const { borders } = this.props();
    const { disputedBorders } = borders;
    this._context.beginPath();
    this._path(this._disputedBorders);
    this._context.setLineDash(disputedBorders.dasharray);
    this._context.strokeStyle = disputedBorders.strokeColor;
    this._context.lineWidth = disputedBorders.strokeWidth;
    this._context.stroke();
    this._context.setLineDash([]);
  }

  _drawCountries(country, value, all) {
    const { globe } = all.props();
    all._context.beginPath();
    all._path(country);
    all._context.fillStyle = globe.colorFill;
    all._context.globalAlpha = value;
    all._context.fill();
  }


  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */


  draw() {
    const props = this.props();
    const topology = this.geo();
    if (!topology) return this;

    const countriesFeatures = props.topology.getCountryFeatures(topology);
    const disputedBoundariesFeatures = props.topology.getDisputedBorderFeatures(topology);
    const landFeatures = props.topology.getLandFeatures(topology);
    const node = this.selection().node();
    const sphere = { type: 'Sphere' };
    const { width } = node.getBoundingClientRect();
    const projection = d3.geoOrthographic().fitExtent([[10, 10], [width - 10, width - 10]], sphere);
    let useData = this.data();
    useData.forEach(function(d) {
      d.perPopulation = d.totalDoses/d.population;
      d.fullyVaccinatedPerPop = d.peopleFullyVaccinated/d.population;
    });

    useData = useData.filter(d => d[props.variableName]>0);
    const filteredCountryKeys = useData.map(d => d.countryISO);
    this._disputedBorders = topojson.mesh(topology, disputedBoundariesFeatures);
    this._land = topojson.feature(topology, landFeatures);
    const countries = topojson.feature(topology, countriesFeatures);
    const filteredCountries = countries.features.filter(d =>filteredCountryKeys.includes(d.properties.isoAlpha2))
    const numberScale=d3.scaleLinear()
      .domain(d3.extent(useData, d => parseFloat(d[props.variableName])))
      .range([0, 1])
    const canvas = this.selection().appendSelect('canvas')
      .attr('width', width * 2)
      .attr('height', width * 2)
      .style('width', `${width}px`)
      .style('height', `${width}px`);

    projection.rotate(this._rotation);

    this._context = canvas.node().getContext('2d');
    this._context.scale(2, 2);
    this._path = d3.geoPath(projection, this._context);

    let destination = [];

    const geoPath = d3.geoPath(
      d3.geoOrthographic()
        .fitExtent([[10, 10], [width - 10, width - 10]], sphere)
        .rotate([-destination[0], props.globe.verticalAxisTilt - destination[1]]),
      this._context
    );
    const dC = this._drawCountries
    const drawMap = (projectedCentroid) => {
      this._context.clearRect(0, 0, width, width);
      this._drawLand();
      this._drawBorders();
      const all = this
      filteredCountries.forEach(function(d){
        const val = numberScale(
            parseFloat(
              useData.filter(e => e.countryISO===d.properties.isoAlpha2)[0][props.variableName]
            )
          )
        dC(d, val, all)
      })
      this._context.globalAlpha = 1;
      this._drawSphere();
    };

    const rotateToPoint = () => {
      const interpolator = d3.interpolate(projection.rotate(), [-destination[0], props.globe.verticalAxisTilt - destination[1]]);
      canvas.transition()
        .duration(props.spinToSpeed)
        .tween('rotate', () =>
          (t) => {
            projection.rotate(interpolator(t));
            const projectedCentroid = projection(destination);
            drawMap(projectedCentroid);
            this._rotation = projection.rotate();
          }
        );
    };

    let lastElapsed = 0;
    const rotate = (elapsed, phiInterpolator) => {
      const scale = d3.scaleLinear()
        .domain([0, props.spinSpeed])
        .range([0, 360]);
      const step = scale(elapsed - lastElapsed);

      const phi = phiInterpolator(Math.min(elapsed / props.spinToSpeed, 1));
      projection.rotate([this._rotation[0] + step, phi]);
      const projectedCentroid = projection(destination);
      drawMap(projectedCentroid);
      this._rotation = projection.rotate();
      lastElapsed = elapsed;
    };

    const resetTimer = () => {
      this._timer.stop();
      this._timer = null;
    };

    if (!props.spin) {
      if (this._timer) resetTimer();
      rotateToPoint();
    } else {
      if (this._timer) resetTimer();
      const phiInterpolator = d3.interpolate(this._rotation[1], props.globe.verticalAxisTilt - destination[1]);
      this._timer = d3.timer((elapsed) => {
        if (!props.spin) {
          resetTimer();
          return;
        }
        rotate(elapsed, phiInterpolator);
      });
    }



    return this;
  }
}


export default VaccineMap;
