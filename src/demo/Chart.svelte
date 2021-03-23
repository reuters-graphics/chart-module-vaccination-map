<!-- ⭐ Write an interactive DEMO of your chart in this component.
Follow the notes below! -->
<script>
  export let responsive; // eslint-disable-line
  import { afterUpdate } from 'svelte';
  import Docs from './App/Docs.svelte';
  import Explorer from './App/Explorer.svelte';
  import VaccineMap from '../js/index';
  import topo from './topo.json';
  import chartData from './data.json';

  let chart = new VaccineMap();
  let chartContainer;

  // 🎚️ Create variables for any data or props you want users to be able
  // to update in the demo. (And write buttons to update them below!)
  let defaultGeo = topo;
  let autoPlay = false;
  // ...

  // 🎈 Tie your custom props back together into one chartProps object.
  $: chartProps = {
    stopShow: autoPlay,
  };

  afterUpdate(() => {
    // ⚡ And let's use your chart!
    chart
      .selection(chartContainer)
      .data(chartData) // Pass your chartData
      .geo(defaultGeo)
      .props(chartProps) // Pass your chartProps
      .draw(); // 🚀 DRAW IT!
  });
</script>

<div id="vaccine-map-container" bind:this={chartContainer} />

<div class="chart-options">
  <!-- ✏️ Create buttons that update your data/props variables when they're clicked! -->
  <button
    on:click={() => {
      autoPlay = false;
    }}>Auto Play</button
  >
  <button
    on:click={() => {
      autoPlay = true;
    }}>Stop Play</button
  >
</div>

<!-- ⚙️ These components will automatically create interactive documentation for you chart! -->
<Docs />
<Explorer title="Data" data={chart.data()} />
<Explorer title="Props" data={chart.props()} />

<!-- 🖌️ Style your demo page here -->
<style lang="scss">
  .chart-options {
    button {
      padding: 5px 15px;
    }
  }
</style>
