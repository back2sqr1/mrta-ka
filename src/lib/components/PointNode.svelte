<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data } = $props<NodeProps>();
</script>

<div class="flex items-center justify-center">
  {#if data.label}
    <div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-sm font-bold text-gray-900 shadow-sm">
      {data.label}
    </div>
  {/if}
  <Handle type="source" position={Position.Right} class="!bg-transparent !w-full !h-full !border-none !top-0 !left-0 !transform-none !rounded-full opacity-0" />
  <Handle type="target" position={Position.Left} class="!bg-transparent !w-full !h-full !border-none !top-0 !left-0 !transform-none !rounded-full opacity-0" />
</div>
