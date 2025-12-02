<script lang="ts">
  import { Panel } from '@xyflow/svelte';

  let {
    selectedNodeId,
    isGroupNode,
    nodeLabel,
    nodeX,
    nodeY,
    nodeColor,
    nodeGroupId,
    isCreatingGroup,
    newGroupName = $bindable(),
    nodeGroupsList,
    updateLabel,
    updateX,
    updateY,
    updateColor,
    updateGroup,
    createGroup,
    cancelCreateGroup
  } = $props();
</script>

{#if selectedNodeId}
  <Panel position="top-right" class="bg-white p-4 rounded shadow-lg border border-gray-200">
    <div class="flex flex-col gap-2">
        <h3 class="font-bold">Edit {isGroupNode ? 'Group' : 'Node'} {selectedNodeId}</h3>
        <label class="flex flex-col">
            <span class="text-sm font-medium">Label:</span>
            <input type="text" value={nodeLabel} oninput={updateLabel} class="border p-1 rounded" />
        </label>
        
        {#if !isGroupNode}
            <label class="flex flex-col">
                <span class="text-sm font-medium">X Coord:</span>
                <input type="number" value={nodeX} oninput={updateX} class="border p-1 rounded" />
            </label>
            <label class="flex flex-col">
                <span class="text-sm font-medium">Y Coord:</span>
                <input type="number" value={nodeY} oninput={updateY} class="border p-1 rounded" />
            </label>
            <label class="flex flex-col">
                <span class="text-sm font-medium">Color:</span>
                <select value={nodeColor} onchange={updateColor} class="border p-1 rounded">
                    <option value="#bbf7d0">Green</option>
                    <option value="#fecaca">Red</option>
                </select>
            </label>
            <label class="flex flex-col">
                <span class="text-sm font-medium">Group:</span>
                {#if isCreatingGroup}
                    <div class="flex flex-col gap-1">
                        <input 
                            type="text" 
                            placeholder="New Group Name"
                            bind:value={newGroupName}
                            class="border p-1 rounded"
                        />
                        <div class="flex gap-1">
                            <button onclick={createGroup} class="bg-blue-500 text-white px-2 py-1 rounded text-xs">Create</button>
                            <button onclick={cancelCreateGroup} class="bg-gray-300 px-2 py-1 rounded text-xs">Cancel</button>
                        </div>
                    </div>
                {:else}
                    <select value={nodeGroupId || ''} onchange={updateGroup} class="border p-1 rounded">
                        <option value="">None</option>
                        {#each nodeGroupsList as group}
                            <option value={group.id}>{group.name}</option>
                        {/each}
                        <option value="__CREATE_NEW__">+ Create New Group</option>
                    </select>
                {/if}
            </label>
        {/if}
    </div>
  </Panel>
{/if}
