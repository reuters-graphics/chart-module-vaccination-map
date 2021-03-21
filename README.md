![](./badge.svg)

# VaccineMap

See the [demo page](https://reuters-graphics.github.io/chart-module-vaccination-map/).

### Install

```
$ yarn add https://github.com/reuters-graphics/chart-module-vaccination-map.git
```

### Use

```javascript
import VaccineMap from '@reuters-graphics/chart-module-vaccination-map';

const chart = new VaccineMap();

// To create your chart, pass a selector string to the chart's selection method,
// as well as any props or data to their respective methods. Then call draw.
chart
  .selection('#chart')
  .data([1, 2, 3])
  .props(
      locale: 'en',

      
      globe: {
        // Stroke of the globe
        strokeColor: 'rgba(255, 255, 255, 0.5)',

        // stroke width of the globe
        strokeWidth: 0.1,

        // Color of land
        landFill: 'rgba(153,153,153,0.2)',

        // Vertical axis tilt
        verticalAxisTilt: 8,

        // Color to use for opacity. It is the bright green right now
        colorFill: '#22BD3B',

        // Tweak range to define starting opacity of the greens
        fillScale: d3.scaleLinear().domain([0, 1]).range([0.05, 1]),

        // For highlighted country stroke of the country
        highlight: {
          // Color
          strokeColor: 'rgba(255,255,255,.5)',
          // Width
          strokeWidth: 1,
        },
      },
      // Primary variable name
      variableName: 'vaccinatedPerPopulation',

      // Spin speeds
      spinToSpeed: 750,
      rotateChange: 3500,

      // When to move the tooltip off the globe and above the globe. Mention width.
      breakpoint: 600,

      // Tooltip text
      sentence:
        "<div class='country'> {{ countryName }}</div> <div class='text'><span class='percent'>{{oneDose}}</span> received at least one dose.</div> <div class='text fully-text'><span class='fully'>{{fully}}</span> have been fully vaccinated.</div>",
      topology: {
        getCountryFeatures: (topology) => topology.objects.countries,
        getDisputedBorderFeatures: (topology) =>
          topology.objects.disputedBoundaries,
        getLandFeatures: (topology) => topology.objects.land,
      },
    )
  .draw();

// You can call any method again to update the chart.
chart
  .data(chartData) // Pass your chartData
  .geo(defaultGeo) // Mandatory to pass topojson here
  .draw();

// Or just call the draw function alone, which is useful for resizing the chart.
chart.draw();
```

To apply this chart's default styles when using SCSS, simply define the variable `$VaccineMap-container` to represent the ID or class of the chart's container(s) and import the `_chart.scss` partial.

```CSS
$VaccineMap-container: '#chart';

@import '~@reuters-graphics/chart-module-vaccination-map/src/scss/chart';
```

## Developing chart modules

Read more in the [DEVELOPING docs](./DEVELOPING.md) about how to write your chart module.