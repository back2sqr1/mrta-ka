<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data } = $props<NodeProps>();
</script>

<div class="flex items-center justify-center">
  {#if data.label}
    <div 
      class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-sm font-bold text-gray-900 shadow-sm"
      style:background-color={data.color}
    >
      {data.label}
    </div>
  {/if}
  <Handle type="source" position={Position.Top} style="top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0;" />
  <Handle type="target" position={Position.Top} style="top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0;" />
</div>
