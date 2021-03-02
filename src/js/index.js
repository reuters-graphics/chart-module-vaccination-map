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
    map_stroke_width: .5,
    map_stroke_color: '#2f353f',
    map_highlight_stroke_width: 1.2,
    map_fill: 'rgba(153,153,153,0.25)',
    map_stroke_color_active: 'rgba(255, 255, 255, 0.75)',
    spike_color: '#eec331',
    heightRatio: (width, breakpoint) => (width < breakpoint ? 0.8 : 0.5),
    locale: 'en',
    map_custom_projections: {
      clip_box: [[-130, 70], [194, -39]],
      projection: 'geoNaturalEarth1',
      center: null,
      scale: null,
      rotate: null,
    },
    hover_gap: 12.5,
    getDataRange: (width) => ({ min: 0, max: 1 }),
    color_scale: d3.scaleSequential(d3.interpolateGreens) // Can use a scale as a prop!
      .domain([0, 1]),
    spike_inactive_opacity: 1,
    disputed_dasharray: [5, 3],
    annotations: {
      name: [],
      value: [],
    },
    mobile: true,
    refBox: {
      height: 90,
      width: 180,
      breakpoint: 900,
      useWidth: (width, factor) => (width * factor),
      factor: 2.2,
    },
    interaction: true,
    variable_name: 'perPopulation',
    // variable_name: 'fullyVaccinatedPerPop',

  };

  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */
  draw() {
    const data = this.data();
    const props = this.props();
    const topo = this.geo();
    if (!topo) return this;
    let useData = data;
    useData.forEach(function(d) {
      d.perPopulation = d.totalDoses/d.population;
      d.fullyVaccinatedPerPop = d.peopleFullyVaccinated/d.population;
    });

    useData = useData.filter(d => d[props.variable_name]>0);
    console.log(useData)
    const node = this.selection().node();
    let { width } = node.getBoundingClientRect();
    const ratio = props.heightRatio(width, props.refBox.breakpoint)
    let useWidth, height;
    if (width < props.refBox.breakpoint && props.mobile) {
      useWidth = props.refBox.useWidth(width,props.refBox.factor);
      this.selection().classed('mobile', true);
      height = useWidth * 0.5;
    } else {
      useWidth = width;
      this.selection().classed('mobile', false);
      height = width * ratio;
    }

    // SVG begins here
    const svg = this.selection()
      .appendSelect('div.chart-container-div')
      .attr('id', 'map-container')
      .style('overflow-x', 'scroll')
      .appendSelect('svg.chart') // see docs in ./utils/d3.js
      .attr('width', useWidth)
      .attr('height', height);

    const g = svg.appendSelect('g');

    if (!d3[props.map_custom_projections.projection]) {
      props.map_custom_projections.projection = 'geoNaturalEarth1';
    }

    const projection = d3[props.map_custom_projections.projection]();
    const countries = topojson.feature(topo, topo.objects.countries);
    const land = topojson.feature(topo, topo.objects.land);

    let disputed;
    if (topo.objects.disputedBoundaries) {
      disputed = topojson.mesh(topo, topo.objects.disputedBoundaries);  
    }

    if (props.map_custom_projections.center && props.map_custom_projections.center.length === 2) {
      projection.center(props.map_custom_projections.center);
    }

    if (props.map_custom_projections.rotate && props.map_custom_projections.rotate.length === 2) {
      projection.rotate(props.map_custom_projections.rotate);
    }
    const filteredCountryKeys = useData.map(d => d.countryISO);

    // Adding some points in the ocean to create voronoi spaces that will
    // reset the map, so as your cursor traces land masses, you get highlights,
    // but in the ocean you can see the whole world picture...

    if (props.map_custom_projections.clip_box && (props.map_custom_projections.clip_box.length === 2 && props.map_custom_projections.clip_box[0].length === 2 && props.map_custom_projections.clip_box[1].length === 2)) {
      projection.fitSize([useWidth, height], makeRangeBox(props.map_custom_projections.clip_box));
    } else {
      projection.fitSize([useWidth, height], countries);
    }

    if (props.map_custom_projections.scale) {
      projection.scale(props.map_custom_projections.scale);
    }

    const path = d3.geoPath().projection(projection);
    svg.selectAll('.country,.disputed,.land').remove();
    const numberScale=d3.scaleLinear()
      .domain(d3.extent(useData, d => parseFloat(d[props.variable_name])))
      .range([0, 1])
    const landGroups = g.appendSelect('g.land')
      .style('pointer-events', 'none')
      .append('path')
      .style('fill', props.map_fill)
      .attr('d', path(land));

    const filteredCountries = countries.features.filter(d =>filteredCountryKeys.includes(d.properties.isoAlpha2))

    const countryGroups = g.appendSelect('g.countries')
      .style('pointer-events', 'none')
      .style('fill', props.map_fill)
      .selectAll('path.country')
      .data(filteredCountries);

    countryGroups
      .enter()
      .append('path')
      .style('stroke', props.map_stroke_color)
      .style('stroke-width', props.map_stroke_width)
      .attr('class', d => `country c-${d.properties.slug} level-0`)
      .merge(countryGroups)
      .attr('fill', function(d) {
        return props.color_scale(
          numberScale(
            parseFloat(
              useData.filter(e => e.countryISO===d.properties.isoAlpha2)[0][props.variable_name]
            )
          )
        );
      })
      .attr('d', path);

    if (disputed) {
      g.appendSelect('path.disputed')
        .attr('class', 'disputed level-0')
        .style('pointer-events', 'none')
        .style('stroke', props.map_stroke_color)
        .style('stroke-width', props.map_stroke_width)
        .style('fill', 'none')
        .style('stroke-dasharray', props.disputed_dasharray)
        .attr('d', path(disputed));
    }

    return this;
  }
}

function makeRangeBox(opts) {
  var lon0 = opts[0][0];
  var lon1 = opts[1][0];
  var lat0 = opts[0][1];
  var lat1 = opts[1][1];

  // to cross antimeridian w/o ambiguity
  if (lon0 > 0 && lon1 < 0) {
    lon1 += 360;
  }

  // to make lat span unambiguous
  if (lat0 > lat1) {
    var tmp = lat0;
    lat0 = lat1;
    lat1 = tmp;
  }

  var dlon4 = (lon1 - lon0) / 4;

  return {
    type: 'Polygon',
    coordinates: [[
      [lon0, lat0],
      [lon0, lat1],
      [lon0 + dlon4, lat1],
      [lon0 + 2 * dlon4, lat1],
      [lon0 + 3 * dlon4, lat1],
      [lon1, lat1],
      [lon1, lat0],
      [lon1 - dlon4, lat0],
      [lon1 - 2 * dlon4, lat0],
      [lon1 - 3 * dlon4, lat0],
      [lon0, lat0],
    ]],
  };
}

export default VaccineMap;
