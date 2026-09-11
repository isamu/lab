<template>
  <div>{{ text }}</div>
</template>

<script setup lang="ts">
const raw: unknown = window;
// eslint-disable-next-line no-console
console.log(raw);
const text = raw as any;
</script>
