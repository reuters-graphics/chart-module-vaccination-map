import 'd3-transition';

import { appendSelect } from 'd3-appendselect';
import merge from 'lodash/merge';
import * as topojson from 'topojson-client';
import * as d3 from 'd3';
import { geoVoronoi } from 'd3-geo-voronoi';
import versor from 'versor/src/index.js';
import Mustache from 'mustache';
// import * as inertia from 'd3-inertia'
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
      strokeColor: '#fff',
      strokeWidth: 0.5,
      strokeOpacity: 0.15,
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
      landFill: 'rgba(163, 190, 140, 0.5)',
      verticalAxisTilt: 15,
      colorFill: '#A3BE8C',
      colorBins: d3.scaleLinear()
        .interpolate(d3.interpolateHcl)
        .domain([0, 0.25, 0.5, 0.75, 1])
        .range([
          d3.rgb('#505753'), d3.rgb('#6B7165'), d3.rgb('#838B78'), d3.rgb('#9BA987'), d3.rgb('#ACBD93') 
        ]),
      fillScale: d3.scaleLinear().domain([0, 1]).range([0.1, 1.05]),
      highlight: {
        strokeColor: 'white',
        strokeWidth: 1.5,
        opacity: 0.5,
      },
    },
    variableName: 'perPopulation',
    spinSpeed: 12000,
    spinToSpeed: 750,
    rotateChange: 3500,
    sentence:
      "<span class='country'> {{ countryName }}</span> has vaccinated atleast <span class='percent'>58%</span> of its population.",
    topology: {
      getCountryFeatures: (topology) => topology.objects.countries,
      getDisputedBorderFeatures: (topology) =>
        topology.objects.disputedBoundaries,
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
    this._context.beginPath();
    this._path(this._countryBorders);
    this._context.strokeStyle = borders.strokeColor;
    this._context.globalAlpha = borders.strokeOpacity;
    this._context.lineWidth = borders.strokeWidth;
    this._context.stroke();
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

  _drawCountries(country, all, highlight) {
    const { globe } = all.props();
    all._context.beginPath();
    all._context.globalAlpha = 1;
    all._path(country);
    all._context.fillStyle = globe.colorBins(country.val);
    all._context.fill();

    if (highlight) {
      all._context.globalAlpha = globe.highlight.opacity;
      all._context.strokeStyle = globe.highlight.strokeColor;
      all._context.lineWidth = globe.highlight.strokeWidth;
      all._context.stroke();
    }
  }

  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */

  draw() {
    if (window.globeTimer) {
      window.globeTimer.stop();
      window.globeTimer = null;
    }
    const props = this.props();
    const topology = this.geo();
    if (!topology) return this;


    const countriesFeatures = props.topology.getCountryFeatures(topology);
    const disputedBoundariesFeatures = props.topology.getDisputedBorderFeatures(
      topology
    );
    const landFeatures = props.topology.getLandFeatures(topology);
    const node = this.selection().node();
    const sphere = { type: 'Sphere' };
    const { width } = node.getBoundingClientRect();
    const projection = d3.geoOrthographic().fitExtent(
      [
        [10, 10],
        [width - 10, width - 10],
      ],
      sphere
    );
    let useData = this.data();
    useData.forEach(function (d) {
      d.perPopulation = d.totalDoses / d.population;
      d.fullyVaccinatedPerPop = d.peopleFullyVaccinated / d.population;
    });

    useData = useData.filter((d) => d[props.variableName] > 0);
    const filteredCountryKeys = useData.map((d) => d.countryISO);
    this._disputedBorders = topojson.mesh(topology, disputedBoundariesFeatures);
    this._countryBorders = topojson.mesh(topology, countriesFeatures);
    this._land = topojson.feature(topology, landFeatures);
    const countries = topojson.feature(topology, countriesFeatures);
    const filteredCountries = countries.features.filter((d) =>
      filteredCountryKeys.includes(d.properties.isoAlpha2)
    );
    const numberScale = d3
      .scaleLinear()
      .domain(d3.extent(useData, (d) => parseFloat(d[props.variableName])))
      .range([0, 1]);

    filteredCountries.forEach(function (d) {
      d.val = numberScale(
        parseFloat(
          useData.filter((e) => e.countryISO === d.properties.isoAlpha2)[0][
            props.variableName
          ]
        )
      );
      console.log(d.val);
    });

    const filteredCountriesRandom = filteredCountries.filter(
      (d) => d.val > 0.01
    );

    const countryCentroids = filteredCountries
      .filter(
        (c) =>
          c.properties.centroid.length == 2 &&
          c.properties.centroid[0] &&
          c.properties.centroid[1]
      )
      .map((c) => ({
        type: 'Feature',
        properties: c.properties,
        geometry: {
          type: 'Point',
          coordinates: c.properties.centroid,
        },
        actualFile: c,
      }));

    const voronoiCentroids = countryCentroids;

    const sentence = this.selection()
      .appendSelect('div.sentence')
      .html(
        Mustache.render(props.sentence, {
          countryName: 'Israel',
          percent: '58%',
        })
      );

    sentence
      .selectAll('.country, .percent')
      .style('color', props.globe.colorFill)
      .style('border-bottom', `${props.globe.colorFill} 1px solid`);

    const canvasContainer = this.selection()
      .appendSelect('div.canvas-container')
      .style('width', `${width}px`)
      .style('height', `${width}px`);

    const canvas = canvasContainer
      .appendSelect('canvas')
      .attr('width', width * 2)
      .attr('height', width * 2)
      .style('width', `${width}px`)
      .style('height', `${width}px`);

    // const svg = canvasContainer
    //   .appendSelect('svg.veronoi')
    //   .attr('width', width)
    //   .attr('height', width)

    // const countryVoronoiCentroids = svg.appendSelect('g.voronoi')
    //   .style('fill', 'none')
    //   .style('pointer-events', 'none')
    //   .selectAll('path.voronoi')
    //   .data()

    const line = canvasContainer
      .appendSelect('svg')
      .attr('height', width)
      .attr('width', width)
      .appendSelect('line.line')
      .style('stroke', props.globe.highlight.strokeColor)
      .attr('x1', `${width / 2}`)
      .attr('x2', `${width / 2}`)
      .attr('y1', `0`)
      .attr('y2', `${(width / 2) * 0.735}`);

    projection.rotate(this._rotation);

    this._context = canvas.node().getContext('2d');
    this._context.scale(2, 2);
    this._path = d3.geoPath(projection, this._context);
    this._pathCheck = d3.geoPath(projection);

    let selectedCountry =
      filteredCountriesRandom[
        Math.floor(Math.random() * filteredCountriesRandom.length)
      ];

    let destination = [];
    destination = selectedCountry.properties.centroid;

    const geoPath = d3.geoPath(
      d3
        .geoOrthographic()
        .fitExtent(
          [
            [10, 10],
            [width - 10, width - 10],
          ],
          sphere
        )
        .rotate([
          -destination[0],
          props.globe.verticalAxisTilt - destination[1],
        ]),
      this._context
    );

    // countryVoronoiCentroids.enter()
    //   .append('path')
    //   .attr('class', d => 'voronoi')
    //   .merge(countryVoronoiCentroids)
    //   .attr('d', this._pathCheck)
    //   .on('mouseover', d => {
    //     // if (props.interaction) {
    //     //   tipOn(d);
    //     // }
    //   })
    //   .on('mouseout', d => {
    //     // if (props.interaction) {
    //     //   tipOff(d);
    //     // }
    //   });

    // countryVoronoiCentroids.exit()
    //   .remove();

    const dC = this._drawCountries;
    const drawMap = (projectedCentroid, highlighted) => {
      this._context.clearRect(0, 0, width, width);
      this._drawLand();
      // const all = this;
      // filteredCountries.forEach(function (d) {
      //   if (d === highlighted) {
      //     dC(d, all, true);
      //   } else {
      //     dC(d, all);
      //   }
      // });

      // this._context.globalAlpha = 1;
      // this._drawBorders();
      this._drawSphere();

      const p = projection(highlighted.properties.centroid);

      line.attr('x2', `${p[0]}`).attr('y2', `${p[1]}`);

      sentence.select('.country').text(highlighted.properties.name);
      sentence
        .select('.percent')
        .text(
          parseInt(
            useData.filter(
              (d) => d.countryISO === highlighted.properties.isoAlpha2
            )[0][props.variableName] * 10000
          ) /
            100 +
            '%'
        );
    };

    const rotateToPoint = () => {
      const interpolator = d3.interpolate(projection.rotate(), [
        -destination[0],
        props.globe.verticalAxisTilt - destination[1],
      ]);

      canvas
        .transition()
        .duration(props.spinToSpeed)
        .tween('rotate', () => (t) => {
          projection.rotate(interpolator(t));
          const projectedCentroid = projection(destination);
          drawMap(projectedCentroid, selectedCountry);
          this._rotation = projection.rotate();
        });
    };

    const loopCountries = () => {
      selectedCountry =
        filteredCountriesRandom[
          Math.floor(Math.random() * filteredCountriesRandom.length)
        ];
      chosenCountry();
    };

    const chosenCountry = () => {
      destination = selectedCountry.properties.centroid;
      const projectedCentroid = projection(destination);
      drawMap(projectedCentroid, selectedCountry);
      this._rotation = projection.rotate();
      rotateToPoint();
    };
    const voronoiShapefile = geoVoronoi().polygons(voronoiCentroids).features;

    const onClickSelect = (event) => {
      const clickedPoint = projection.invert(d3.pointer(event));

      for (let i = 0; i < voronoiShapefile.length; i++) {
        if (d3.geoContains(voronoiShapefile[i], clickedPoint)) {
          selectedCountry = voronoiShapefile[i].properties.site.actualFile;
          break;
        }
      }

      chosenCountry(selectedCountry);
    };

    const onDragSelect = () => {
      const clickedPoint = projection.invert([width / 2, width / 2]);

      let chosenObj;
      for (let i = 0; i < voronoiShapefile.length; i++) {
        if (d3.geoContains(voronoiShapefile[i], clickedPoint)) {
          // selectedCountry = voronoiShapefile[i].properties.site.actualFile;
          chosenObj = voronoiShapefile[i].properties.site.actualFile;
          break;
        }
      }

      drawMap(false, chosenObj);
    };

    const resetTimer = () => {
      if (window.globeTimer) {
        window.globeTimer.stop();
        window.globeTimer = null;
      }
    };

    if (window.globeTimer) {
      resetTimer();
      window.globeTimer = d3.interval(loopCountries, props.rotateChange);
    } else {
      loopCountries();
      window.globeTimer = d3.interval(loopCountries, props.rotateChange);
    }

    function drag(projection) {
      let v0, q0, r0, a0, l;

      function pointer(event, that) {
        const t = d3.pointers(event, that);

        if (t.length !== l) {
          l = t.length;
          if (l > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
          dragstarted.apply(that, [event, that]);
        }

        // For multitouch, average positions and compute rotation.
        if (l > 1) {
          const x = d3.mean(t, (p) => p[0]);
          const y = d3.mean(t, (p) => p[1]);
          const a = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
          return [x, y, a];
        }

        return t[0];
      }

      function dragstarted(event) {
        resetTimer();
        v0 = versor.cartesian(projection.invert(pointer(event, this)));
        q0 = versor((r0 = projection.rotate()));
      }

      function dragged(event) {
        const p = pointer(event, this);
        const v1 = versor.cartesian(projection.rotate(r0).invert(p));
        const delta = versor.delta(v0, v1);
        let q1 = versor.multiply(q0, delta);

        // For multitouch, compose with a rotation around the axis.
        if (p[2]) {
          const d = (p[2] - a0) / 2;
          const s = -Math.sin(d);
          const c = Math.sign(Math.cos(d));
          q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, c * s], q1);
        }

        projection.rotate(versor.rotation(q1));

        // In vicinity of the antipode (unstable) of q0, restart.
        if (delta[0] < 0.7) dragstarted.apply(this, [event, this]);
      }

      return d3.drag().on('start', dragstarted).on('drag', dragged);
    }

    canvas
      .call(
        drag(projection).on('drag.render', function () {
          onDragSelect();
        })
      )
      .on('click', (event) => {
        onClickSelect(event);
      });

    //   const phiInterpolator = d3.interpolate(this._rotation[1], props.globe.verticalAxisTilt - destination[1]);
    //   this._timer = d3.timer((elapsed) => {
    //     if (!props.spin) {
    //       resetTimer();
    //       return;
    //     }
    //     rotate(elapsed, phiInterpolator);
    //   });

    return this;
  }
}

export default VaccineMap;
