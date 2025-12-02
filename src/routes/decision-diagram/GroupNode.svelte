<script lang="ts">
  import { NodeResizer, type NodeProps } from '@xyflow/svelte';

  let { data, selected }: NodeProps = $props();
</script>

<NodeResizer
  minWidth={100}
  minHeight={50}
  isVisible={selected}
  color="#ff0071"
/>

<div style="padding: 10px; width: 100%; height: 100%;">
    {data.label}
</div>
