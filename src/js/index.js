import 'd3-transition';

import * as d3 from 'd3';
import * as topojson from 'topojson-client';

import Mustache from 'mustache';
import { appendSelect } from 'd3-appendselect';
import { geoVoronoi } from 'd3-geo-voronoi';
import merge from 'lodash/merge';
import spin from './spin.js';
import versor from 'versor/src/index.js';

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
    locale: 'en',
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
      landFill: 'rgba(153,153,153,0.2)',
      verticalAxisTilt: 8,
      colorFill: '#22BD3B',
      fillScale: d3.scaleLinear().domain([0, 1]).range([0.05, 1]),
      linearGradientForKey:
        'linear-gradient(90deg, rgba(34,189,59,0.05) 0%, rgba(34,189,59,1) 100%)',
      highlight: {
        strokeColor: 'rgba(255,255,255,.65)',
        strokeWidth: 1,
      },
    },
    variableName: 'vaccinatedPerPopulation',
    spin: false,
    spinToSpeed: 750,
    rotateChange: 3500,
    breakpoint: 600,
    stopShow: false,
    spinText: 'Spin me',
    numberRound: function (d) {
      const num = d3.format('.1~%')(d);
      if (d < 0.001) {
        return '<0.1%';
      } else {
        return num.replace('.0', '');
      }
    },
    sentence:
      "<div class='country'> {{ countryName }}</div> <div class='text'><span class='percent'>{{oneDose}}</span> received at least one dose</div> <div class='text fully-text'><span class='fully'>{{fully}}</span> have been fully vaccinated</div>",
    topology: {
      getCountryFeatures: (topology) => topology.objects.countries,
      getDisputedBorderFeatures: (topology) =>
        topology.objects.disputedBoundaries,
      getLandFeatures: (topology) => topology.objects.land,
    },
    colorScaleText: '% of people given at least one dose',
    colorScaleWidth: 250,
    colorScaleMargin: 5,
    colorScaleHeight: 8,
    colorLabel: {
      lessText: 'Less',
      moreText: 'More',
    },
    maxLoops: 15,
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

  _drawCountries(country, all, highlight) {
    const { globe } = all.props();

    all._context.beginPath();
    all._path(country);
    all._context.fillStyle = globe.colorFill;
    all._context.globalAlpha = globe.fillScale(country.colourVal);

    all._context.fill();

    if (highlight) {
      all._context.globalAlpha = 1;
      all._context.strokeStyle = globe.highlight.strokeColor;
      all._context.lineWidth = globe.highlight.strokeWidth;
      all._context.stroke();
    }
  }

  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */

  _clearTimer() {
    if (this.globeTimer) {
      this.globeTimer.stop();
      this.globeTimer = null;
    }
  }

  draw() {
    const props = this.props();

    const topology = this.geo();
    if (!topology) return this;

    this._clearTimer();

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
    let useData = this.data().map((d) => {
      return {
        ...d,
        perPopulation: d.totalDoses / d.population,
        vaccinatedPerPopulation: d.peopleVaccinated / d.population,
        fullyVaccinatedPerPop: d.peopleFullyVaccinated / d.population,
      };
    });

    // for (let i = 0; i < useData.length; i++) {
    //   const d = useData[i];
    //   d.perPopulation = d.totalDoses / d.population;
    //   d.vaccinatedPerPopulation = d.peopleVaccinated / d.population;
    //   d.fullyVaccinatedPerPop = d.peopleFullyVaccinated / d.population;
    // }

    useData = useData.filter((d) => d[props.variableName] > 0);
    const filteredCountryKeys = useData.map((d) => d.countryISO);
    this._disputedBorders = topojson.mesh(topology, disputedBoundariesFeatures);
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
      d.colourVal = numberScale(
        parseFloat(
          useData.filter((e) => e.countryISO === d.properties.isoAlpha2)[0][
            props.variableName
          ]
        )
      );

      d.val = parseFloat(
        useData.filter((e) => e.countryISO === d.properties.isoAlpha2)[0][
          props.variableName
        ]
      );

      d.fully = parseFloat(
        useData.filter((e) => e.countryISO === d.properties.isoAlpha2)[0]
          .fullyVaccinatedPerPop
      );
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

    this.selection()
      .appendSelect('div.spin-me')
      .html(spin + `<div class="spin-text">${props.spinText}</div>`);

    const sentenceG = this.selection()
      .classed('mobile', width < props.breakpoint)
      .appendSelect('div.sentence-container');

    const sentence = sentenceG.appendSelect('div.sentence').html(
      Mustache.render(props.sentence, {
        countryName: 'Country',
        oneDose: 'Percent',
        fully: null,
      })
    );
    sentence.appendSelect('div.inner-arrow.arrow');
    sentenceG.appendSelect('div.outer-arrow.arrow');

    const canvasContainer = this.selection()
      .appendSelect('div.canvas-container')
      .style('width', `${width}px`)
      .style('height', `${width}px`);

    const colorScaleDiv = this.selection()
      .appendSelect('div.color-scale-group')
      .style('width', props.colorScaleWidth + 'px')
      .style('left', width / 2 - props.colorScaleWidth / 2 + 'px');

    colorScaleDiv
      .appendSelect('div.color-scale-text')
      .text(props.colorScaleText);

    colorScaleDiv
      .appendSelect('div.color-scale')
      .style('height', props.colorScaleHeight + 'px')
      .style('margin', props.colorScaleMargin + 'px 0')
      .style('background', props.globe.linearGradientForKey);

    const colorLabels = colorScaleDiv.appendSelect('div.color-labels');

    colorLabels.appendSelect('div.less').text(props.colorLabel.lessText);

    colorLabels.appendSelect('div.more').text(props.colorLabel.moreText);

    const canvas = canvasContainer
      .appendSelect('canvas')
      .attr('width', width * 2)
      .attr('height', width * 2)
      .style('width', `${width}px`)
      .style('height', `${width}px`);

    const line = canvasContainer
      .appendSelect('svg')
      .attr('height', width)
      .attr('width', width)
      .appendSelect('line.line.globe-ref-line')
      .style('stroke', props.globe.highlight.strokeColor)
      .attr('x1', `${width / 2 + 1}`)
      .attr('x2', `${width / 2 + 1}`)
      .attr(
        'y1',
        width > props.breakpoint
          ? d3.select('.sentence-container').node().getBoundingClientRect()
              .height +
              width * 0.08
          : 5
      )
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

    const dC = this._drawCountries;
    const drawMap = (projectedCentroid, highlighted) => {
      this._context.clearRect(0, 0, width, width);
      this._drawLand();
      this._drawBorders();
      const all = this;
      filteredCountries.forEach(function (d) {
        if (d === highlighted) {
          dC(d, all, true);
        } else {
          dC(d, all);
        }
      });

      this._context.globalAlpha = 1;
      this._drawSphere();

      const p = projection(highlighted.properties.centroid);
      const difference = highlighted.fully > 0 ? 10 : -4;

      line
        .attr('x2', `${p[0]}`)
        .attr('y2', `${p[1]}`)
        .attr(
          'y1',
          width > props.breakpoint
            ? d3.select('.sentence-container').node().getBoundingClientRect()
                .height +
                width * 0.08 +
                difference
            : 0
        );
      sentence.select('.country').text(highlighted.properties.name);
      sentence.select('.percent').text(() => {
        return props.numberRound(highlighted.val);
      });

      sentence
        .select('.fully-text')
        .classed('hide', highlighted.fully === 0 || highlighted.fully === null)
        .select('.fully')
        .text(props.numberRound(highlighted.fully));
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

    let loopCount = 0;

    const loopCountries = () => {
      if (loopCount >= props.maxLoops) this._clearTimer();
      loopCount += 1;
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
      const difference = selectedCountry.fully > 0 ? 10 : -5;
      d3.select('line.line.globe-ref-line').attr(
        'y1',
        width > props.breakpoint
          ? d3.select('.sentence-container').node().getBoundingClientRect()
              .height +
              width * 0.08 +
              difference
          : 0
      );
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

    if (!props.stopShow) {
      loopCountries();
      this.globeTimer = d3.interval(loopCountries, props.rotateChange);
    } else {
      selectedCountry =
        filteredCountriesRandom[
          Math.floor(Math.random() * filteredCountriesRandom.length)
        ];
      chosenCountry();
    }

    const drag = (projection) => {
      let v0, q0, r0, a0, l;

      const pointer = (event) => {
        const t = d3.pointers(event, canvas.node());

        if (t.length !== l) {
          l = t.length;
          if (l > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
          dragstarted.apply(canvas.node(), [event]);
        }

        // For multitouch, average positions and compute rotation.
        if (l > 1) {
          const x = d3.mean(t, (p) => p[0]);
          const y = d3.mean(t, (p) => p[1]);
          const a = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
          return [x, y, a];
        }

        return t[0];
      };

      const dragstarted = (event) => {
        this._clearTimer();
        v0 = versor.cartesian(projection.invert(pointer(event)));
        q0 = versor((r0 = projection.rotate()));
      };

      const dragged = (event) => {
        const p = pointer(event);
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

        const [lambda, phi] = versor.rotation(q1);
        projection.rotate([lambda, phi, 0]); // We lock gamma, never rotating the third axis angle.

        // In vicinity of the antipode (unstable) of q0, restart.
        if (delta[0] < 0.7) dragstarted.apply(this, [event]);
      };

      return d3.drag().on('start', dragstarted).on('drag', dragged);
    };

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
