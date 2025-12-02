<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import Flow from './Flow.svelte';
</script>
 
<!-- You need the SvelteFlowProvider so you can useSvelteFlow  -->
<div class="relative">
  <a
    href="/"
    class="absolute left-4 top-4 z-10 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
  >
    Back to Map
  </a>
  <SvelteFlowProvider>
    <Flow />
  </SvelteFlowProvider>
</div>