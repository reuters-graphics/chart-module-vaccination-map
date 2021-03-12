<!-- ⭐ Write an interactive DEMO of your chart in this component.
Follow the notes below! -->
<script>
  export let responsive; // eslint-disable-line
  import { afterUpdate } from 'svelte';
  import Docs from './App/Docs.svelte';
  import Explorer from './App/Explorer.svelte';
  import VaccineMap from '../js/index';
  import topo from './topo.json'
  import chartData from './data.json'

  let chart = new VaccineMap();
  let chartTwo = new VaccineMap();
  let chartThree = new VaccineMap();


  let chartContainer, chartContainerTwo, chartContainerThree;

  // 🎚️ Create variables for any data or props you want users to be able
  // to update in the demo. (And write buttons to update them below!)
  let defaultGeo = topo

  // ...

  // 🎈 Tie your custom props back together into one chartProps object.
  $: chartProps = {         
      mobile: false,
      heightRatio: (width, breakpoint) => (width < breakpoint ? 0.5 : 0.4), 
  };

  afterUpdate(() => {
    // 💪 Create a new chart instance of your module.
    chart = new VaccineMap();
    // ⚡ And let's use your chart!
    chart
      .selection(chartContainer)
      .data(chartData) // Pass your chartData
      .geo(defaultGeo)
      .props(chartProps) // Pass your chartProps
      .draw(); // 🚀 DRAW IT!

    // 💪 Create a new chart instance of your module.
    chartTwo = new VaccineMap();
    // ⚡ And let's use your chart!
    chartTwo
      .selection(chartContainerTwo)
      .data(chartData) // Pass your chartData
      .geo(defaultGeo)
      .props({
         filter: (d) => (d.vaccinatedPerPopulation <= .3 && d.vaccinatedPerPopulation >.1),
         heightRatio: (width, breakpoint) => (width < breakpoint ? 0.5 : 0.4),
          mobile: false,
      }) // Pass your chartProps
      .draw(); // 🚀 DRAW IT!

    // 💪 Create a new chart instance of your module.
    chartThree = new VaccineMap();
    // ⚡ And let's use your chart!
    chartThree
      .selection(chartContainerThree)
      .data(chartData) // Pass your chartData
      .geo(defaultGeo)
      .props({
         filter: (d) => d.vaccinatedPerPopulation >= .1,
         heightRatio: (width, breakpoint) => (width < breakpoint ? 0.5 : 0.4),
          mobile: false,
          rest: true,
      }) // Pass your chartProps
      .draw(); // 🚀 DRAW IT!
  });

</script>

<!-- 🖌️ Style your demo page here -->
<style lang="scss">
  .chart-options {
    button {
      padding: 5px 15px;
    }
  }
</style>

<div id="vaccine-map-container">
  <div id="chart-1" bind:this={chartContainer}></div>
  <div id="chart-2" bind:this={chartContainerTwo}></div>
  <div id="chart-3" bind:this={chartContainerThree}></div>


</div>


<div class="chart-options">
  <!-- ✏️ Create buttons that update your data/props variables when they're clicked! -->
  <button
    on:click={() => {
      chartData = getRandomData();
    }}>New data</button>
  <button
    on:click={() => {
      circleFill = circleFill === 'orange' ? 'steelblue' : 'orange';
    }}>Change fill</button>
</div>

<!-- ⚙️ These components will automatically create interactive documentation for you chart! -->
<Docs />
<Explorer title='Data' data={chart.data()} />
<Explorer title='Props' data={chart.props()} />
