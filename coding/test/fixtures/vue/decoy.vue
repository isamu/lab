<template>
  <!-- A decoy template. Nothing here may be reported. -->
  <div class="wrapper" data-note="eslint-disable-next-line no-console">
    <p>don't use as any here — this is just body text</p>
    <a :href="'https://example.com//path'">a link that merely mentions @ts-ignore</a>
    <span>{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: number }>();
const label = computed(() => String(props.value));
</script>

<style scoped>
/* a style block whose comment mentions as any and eslint-disable */
.wrapper {
  color: red;
}
</style>
