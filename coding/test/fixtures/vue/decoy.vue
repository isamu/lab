<template>
  <!-- このテンプレートは probe を誤らせるための囮。ここから 1 件も検出されてはいけない。 -->
  <div class="wrapper" data-note="eslint-disable-next-line no-console">
    <p>don't use as any here — これはただの本文です</p>
    <a :href="'https://example.com//path'">@ts-ignore と書いてあるだけのリンク</a>
    <span>{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: number }>();
const label = computed(() => String(props.value));
</script>

<style scoped>
/* as any / eslint-disable をコメントに含む style ブロック */
.wrapper {
  color: red;
}
</style>
