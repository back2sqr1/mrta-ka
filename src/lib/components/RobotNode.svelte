<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';

  let { data } = $props<NodeProps>();
</script>

<div class="flex items-center justify-center">
  <div 
    class="flex h-8 w-8 items-center justify-center rounded-md border-2 border-gray-900 text-sm font-bold text-white shadow-sm"
    style:background-color={data.is_leader ? 'red' : 'green'}
  >
    {data.label}
  </div>
  <Handle type="source" position={Position.Right} class="!bg-transparent !w-full !h-full !border-none !top-0 !left-0 !transform-none !rounded-full opacity-0" />
  <Handle type="target" position={Position.Left} class="!bg-transparent !w-full !h-full !border-none !top-0 !left-0 !transform-none !rounded-full opacity-0" />
</div>
