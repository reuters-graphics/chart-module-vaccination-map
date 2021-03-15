import 'd3-transition';

import * as d3 from 'd3';
import * as topojson from 'topojson-client';

import AtlasMetadataClient from '@reuters-graphics/graphics-atlas-client';
import { appendSelect } from 'd3-appendselect';
import { filter } from 'lodash';
import merge from 'lodash/merge';

// import { geoVoronoi } from 'd3-geo-voronoi';
const geoClient = new AtlasMetadataClient();
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
  defaultData = [];

  /**
   * Default props are the built-in styles your chart comes with
   * that you want to allow a user to customize. Remember, you can
   * pass in complex data here, like default d3 axes or accessor
   * functions that can get properties from your data.
   */
  defaultProps = {
    disputed: false,
    getMapHeightRatio: (width, breakpoint) => (width < breakpoint ? 0.8 : 0.9),
    map: {
      getHeightRatio: (width, minWidth = 900) => width < minWidth ? 0.4 : 0.4,
      getWidth: (containerWidth, minWidth) => Math.max(minWidth, containerWidth),
      minWidth: 900,
      margin: {
        bottom: 90,
      },
      projection: {
        clipbox: null,
        name: 'geoNaturalEarth1',
        center: null,
        scale: null,
        rotate: null,
      },
      styles: {
        land: {
          fill: 'rgba(153,153,153,0.1)',
          stroke: 'rgba(153,153,153,0.25)',
          strokeWidth: 0,
        },
        country: {
          fill: '#74c476',
          stroke: '#2f353f',
          strokeWidth: 1,
          opacity: 0.3,
        },
        marker: {
          radius: {
            min: 2,
            max: 20,
          },
          pulseFrequency: {
            min: 10,
            max: 2,
          },
          outer: {
            fill: 'transparent',
            opacity: 0.2,
            strokeWidth: 1,
            stroke: 'rgba(255,255,255,0.2)',
          },
          inner: {
            fill: '#74c476',
            strokeWidth: 1,
            stroke: '#74c476',
            opacity: 0.6,
          },
        },
      },
    },
    data: {
      getSize: d => d.peopleVaccinated / d.population,
      getPace: d => d.latestWeekDosesPerPop,
    },
    miniMapNav: {
      miniMapHeight: 90,
      miniMapWidth: 180,
      useBelowContainerWidth: 900,
      mapHeightFactor: 2.2,
    },
    countryFilter: d => {
      const country = geoClient.getCountry(d.countryISO);
      // if (country.region.name === 'Europe') return d.population > 0;
      return d.population > 100000 || d.peopleVaccinatedPerPop > 0;
    },
    paceFilter: d => {
      return d.population > 100000 || d.peopleVaccinatedPerPop > 0.4;
    },
  };

  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */
  draw() {
    const props = this.props();
    const topo = this.geo();
    if (!topo) return this;

    const data = this.data()
      .filter(props.countryFilter)
      .map(d => {
        const { countryISO } = d;
        const spread = props.data.getSize(d);
        const frequency = props.data.getPace(d);
        return { spread, frequency, countryISO };
      })
      .filter(d => d.spread && d.frequency);

    const node = this.selection().node();
    const { width: containerWidth } = node.getBoundingClientRect();

    const width = props.map.getWidth(containerWidth, props.map.minWidth);
    const height = width * props.map.getHeightRatio(containerWidth, props.map.minWidth);

    if (containerWidth < props.map.minWidth) this.selection().classed('mobile', true);

    const { styles: mapStyles } = props.map;

    const opacityScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.spread)])
      .range([0.01, 0.5]);

    const radiusScale = d3.scaleSqrt()
      .range([mapStyles.marker.radius.min, mapStyles.marker.radius.max])
      .domain([0, d3.max(data, d => d.spread)]);

    const paceScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.frequency))
      .range([mapStyles.marker.pulseFrequency.min, mapStyles.marker.pulseFrequency.max]);

    // SVG begins here
    const svg = this.selection()
      .appendSelect('div.map-container')
      .attr('id', 'map-container')
      .style('overflow-x', 'scroll')
      .style('height', `${height + props.map.margin.bottom}px`)
      .appendSelect('svg.chart')
      .attr('width', width)
      .attr('height', height);

    const g = svg.appendSelect('g');

    const projection = d3[props.map.projection.name] ?
      d3[props.map.projection.name]() :
      d3.geoNaturalEarth1();

    const countries = topojson.feature(topo, topo.objects.countries);
    // const land = topojson.feature(topo, topo.objects.land);

    let disputed;
    if (topo.objects.disputedBoundaries) {
      disputed = topojson.mesh(topo, topo.objects.disputedBoundaries);
    }

    if (props.map.projection.center && props.map.projection.center.length === 2) {
      projection.center(props.map.projection.center);
    }

    const filteredCountryKeys = data
      .map(d => d.countryISO);

    // Adding some points in the ocean to create voronoi spaces that will
    // reset the map, so as your cursor traces land masses, you get highlights,
    // but in the ocean you can see the whole world picture...

    const { clipbox } = props.map.projection;
    if (clipbox && (clipbox.length === 2)) {
      projection.fitSize([width, height], makeRangeBox(clipbox));
    } else {
      projection.fitSize([width, height], countries);
    }

    if (props.map.projection.scale) {
      projection.scale(props.map.projection.scale);
    }

    const path = d3.geoPath().projection(projection);

    if (props.disputed) {
      g.appendSelect('path.disputed-borders')
        .style('pointer-events', 'none')
        .style('stroke', mapStyles.country.stroke)
        .style('stroke-width', mapStyles.country.strokeWidth)
        .style('fill', 'none')
        .style('stroke-dasharray', [5, 3])
        .attr('d', path(disputed));
    }

    const landCountries = countries.features
      .filter(d => d.properties.slug !== 'antarctica');
    const filteredCountries = countries.features
      .filter(d => filteredCountryKeys.includes(d.properties.isoAlpha2));

    const filteredCountriesCentroids = filteredCountries.map(({ properties }) => ({
      type: 'Feature',
      properties,
      geometry: {
        type: 'Point',
        coordinates: properties.centroid,
      },
    }));

    const getCX = (d) => projection(d.properties.centroid)[0];

    const getCY = (d) => projection(d.properties.centroid)[1];

    const getCountry = (d) => data.find(e => e.countryISO === d.properties.isoAlpha2);

    const getOpacity = (d) => {
      const o = getCountry(d);
      return o ? opacityScale(o.spread) : 0;
    };

    const getR = (d) => {
      const o = getCountry(d);
      return o ? radiusScale(o.spread) : 0;
    };

    const getPace = (d) => {
      const o = getCountry(d);
      return o ? paceScale(o.frequency) : null;
    };

    g.appendSelect('g.land')
      .style('pointer-events', 'none')
      .selectAll('path.country-land')
      .data(landCountries)
      .join('path')
      .attr('class', d => `country-land l-${d.properties.slug}`)
      .style('stroke', mapStyles.land.stroke)
      .style('stroke-width', mapStyles.land.strokeWidth)
      .style('fill', mapStyles.land.fill)
      .attr('d', path);

    g.appendSelect('g.countries')
      .style('pointer-events', 'none')
      .selectAll('path.country')
      .data(filteredCountries)
      .join('path')
      .style('stroke', mapStyles.country.stroke)
      .style('stroke-width', mapStyles.country.strokeWidth)
      .attr('class', d => `country c-${d.properties.slug} level-0`)
      .style('opacity', getOpacity)
      .style('fill', mapStyles.country.fill)
      .attr('d', path);

    const beaconGroups = g.appendSelect('g.beacons-of-hope')
      .style('pointer-events', 'none');

    // const arcScale = d3.scaleLinear()
    //   .domain([0, 1])
    //   .range([0, Math.PI * 2]);

    // const outerRadius = 10;

    // const arc = d3.arc()
    //   .innerRadius(outerRadius - 4)
    //   .outerRadius(outerRadius);

    // const countryDonutGroup = g.appendSelect('g.donuts');
    // countryDonutGroup
    //   .selectAll('path.country-donut-background')
    //   .data(filteredCountriesCentroids.filter(d => d.geometry.coordinates[0]))
    //   .join('path')
    //   .attr('class', 'country-donut-background')
    //   .attr('transform', d => `translate(${getCX(d)}, ${getCY(d)})`)
    //   .style('fill', '#999')
    //   .attr('d', d => {
    //     const o = data.filter(e => e.countryISO === d.properties.isoAlpha2)[0];
    //     return arc
    //       .startAngle(0)
    //       .endAngle(arcScale(1))();
    //   });
    // countryDonutGroup
    //   .selectAll('path.country-donut-foreground')
    //   .data(filteredCountriesCentroids.filter(d => d.geometry.coordinates[0]))
    //   .join('path')
    //   .attr('class', 'country-donut-foreground')
    //   .attr('transform', d => `translate(${getCX(d)}, ${getCY(d)})`)
    //   .style('fill', 'white')
    //   .attr('d', d => {
    //     const o = data.filter(e => e.countryISO === d.properties.isoAlpha2)[0];
    //     return arc
    //       .startAngle(0)
    //       .endAngle(arcScale(o.spread))();
    //   });

    const countryCircleGroups = beaconGroups.selectAll('g.country')
      .data(filteredCountriesCentroids.filter(d => d.geometry.coordinates[0]))
      .join('g')
      .attr('class', 'country');

    // countryCircleGroups.appendSelect('circle.data-point')
    //   .style('opacity', mapStyles.marker.outer.opacity)
    //   .style('fill', mapStyles.marker.outer.fill)
    //   .style('stroke', mapStyles.marker.outer.stroke)
    //   .style('stroke-width', mapStyles.marker.outer.strokeWidth)
    //   .attr('cx', getCX)
    //   .attr('cy', getCY)
    //   .attr('r', getR);

    countryCircleGroups.appendSelect('circle.pulse')
      .style('fill', mapStyles.marker.inner.fill)
      .style('stroke', mapStyles.marker.inner.stroke)
      .style('stroke-width', mapStyles.marker.inner.strokeWidth)
      .style('animation-duration', d => `${getPace(d)}s`)
      .style('opacity', mapStyles.marker.inner.opacity)
      .style('stroke-opacity', 0)
      .attr('cx', getCX)
      .attr('cy', getCY)
      .attr('r', getR);

    countryCircleGroups.appendSelect('circle.pulse.offset-1')
      .style('fill', mapStyles.marker.inner.fill)
      .style('stroke', mapStyles.marker.inner.stroke)
      .style('stroke-width', mapStyles.marker.inner.strokeWidth)
      .style('animation-delay', d => `${getPace(d) * (1 / 3)}s`)
      .style('animation-duration', d => `${getPace(d)}s`)
      .style('opacity', mapStyles.marker.inner.opacity)
      .style('stroke-opacity', 0)
      .attr('cx', getCX)
      .attr('cy', getCY)
      .attr('r', getR);

    countryCircleGroups.appendSelect('circle.pulse.offset-2')
      .style('fill', mapStyles.marker.inner.fill)
      .style('stroke', mapStyles.marker.inner.stroke)
      .style('stroke-width', mapStyles.marker.inner.strokeWidth)
      .style('animation-delay', d => `${getPace(d) * (2 / 3)}s`)
      .style('animation-duration', d => `${getPace(d)}s`)
      .style('opacity', mapStyles.marker.inner.opacity)
      .style('stroke-opacity', 0)
      .attr('cx', getCX)
      .attr('cy', getCY)
      .attr('r', getR);

    this.selection().style('position', 'relative');
    this.selection().appendSelect('div.key.coverage')
      .style('position', 'absolute')
      .style('bottom', '60px')
      .style('left', `${width / 2 - 150}px`)
      .style('width', '120px')
      .text('Percent of pop. given at least 1 dose');
    this.selection().appendSelect('div.key.pace')
      .style('position', 'absolute')
      .style('bottom', '60px')
      .style('left', `${width / 2 + 30}px`)
      .style('width', '120px')
      .text('Pace of rollout in last reported week');

    const keySVGHeight = 70;
    const keyWidth = 120;

    const svgCoverage = this.selection().appendSelect('svg.key.coverage')
      .style('position', 'absolute')
      .style('bottom', '0px')
      .style('left', `${width / 2 - 150}px`)
      .attr('height', keySVGHeight)
      .attr('width', keyWidth);
    svgCoverage.appendSelect('circle.max')
      .attr('r', 30 / 2)
      .attr('cx', keyWidth * (1 / 4))
      .attr('cy', keySVGHeight / 2)
      .style('stroke', mapStyles.marker.outer.stroke)
      .style('fill', 'transparent');
    svgCoverage.appendSelect('circle.min')
      .attr('r', 10 / 2)
      .attr('cx', keyWidth * (3 / 4))
      .attr('cy', keySVGHeight / 2)
      .style('stroke', mapStyles.marker.outer.stroke)
      .style('fill', 'transparent');
    svgCoverage.appendSelect('text.max')
      .attr('x', keyWidth * (1 / 4))
      .attr('y', keySVGHeight - 5)
      .text('More');
    svgCoverage.appendSelect('text.min')
      .attr('x', keyWidth * (3 / 4))
      .attr('y', keySVGHeight - 5)
      .text('Less');

    const svgPace = this.selection().appendSelect('svg.key.pace')
      .style('position', 'absolute')
      .style('bottom', '0px')
      .style('left', `${width / 2 + 30}px`)
      .attr('height', keySVGHeight)
      .attr('width', keyWidth);

    const [slowPace, fastPace] = paceScale.range();

    svgPace.appendSelect('circle.max.pulse')
      .style('fill', mapStyles.marker.inner.fill)
      .style('animation-duration', `${fastPace}s`)
      .attr('cx', keyWidth * (1 / 4))
      .attr('cy', keySVGHeight / 2)
      .attr('r', 20);

    svgPace.appendSelect('circle.max.pulse.offset-1')
      .style('fill', mapStyles.marker.inner.fill)
      .style('animation-delay', d => `${fastPace * (1 / 3)}s`)
      .style('animation-duration', d => `${fastPace}s`)
      .attr('cx', keyWidth * (1 / 4))
      .attr('cy', keySVGHeight / 2)
      .attr('r', 20);

    svgPace.appendSelect('circle.max.pulse.offset-2')
      .style('fill', mapStyles.marker.inner.fill)
      .style('animation-delay', d => `${fastPace * (2 / 3)}s`)
      .style('animation-duration', d => `${fastPace}s`)
      .attr('cx', keyWidth * (1 / 4))
      .attr('cy', keySVGHeight / 2)
      .attr('r', 20);

    svgPace.appendSelect('circle.min.pulse')
      .style('fill', mapStyles.marker.inner.fill)
      .style('animation-duration', `${slowPace}s`)
      .attr('cx', keyWidth * (3 / 4))
      .attr('cy', keySVGHeight / 2)
      .attr('r', 20);

    svgPace.appendSelect('circle.min.pulse.offset-1')
      .style('fill', mapStyles.marker.inner.fill)
      .style('animation-delay', d => `${slowPace * (1 / 3)}s`)
      .style('animation-duration', d => `${slowPace}s`)
      .attr('cx', keyWidth * (3 / 4))
      .attr('cy', keySVGHeight / 2)
      .attr('r', 20);

    svgPace.appendSelect('circle.min.pulse.offset-2')
      .style('fill', mapStyles.marker.inner.fill)
      .style('animation-delay', d => `${slowPace * (2 / 3)}s`)
      .style('animation-duration', d => `${slowPace}s`)
      .attr('cx', keyWidth * (3 / 4))
      .attr('cy', keySVGHeight / 2)
      .attr('r', 20);

    svgPace.appendSelect('text.max')
      .attr('x', keyWidth * (1 / 4))
      .attr('y', keySVGHeight - 5)
      .text('Faster');
    svgPace.appendSelect('text.min')
      .attr('x', keyWidth * (3 / 4))
      .attr('y', keySVGHeight - 5)
      .text('Slower');

    return this;
  }
}

function makeRangeBox(opts) {
  const lon0 = opts[0][0];
  let lon1 = opts[1][0];
  let lat0 = opts[0][1];
  let lat1 = opts[1][1];

  // to cross antimeridian w/o ambiguity
  if (lon0 > 0 && lon1 < 0) {
    lon1 += 360;
  }

  // to make lat span unambiguous
  if (lat0 > lat1) {
    const tmp = lat0;
    lat0 = lat1;
    lat1 = tmp;
  }

  const dlon4 = (lon1 - lon0) / 4;

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
