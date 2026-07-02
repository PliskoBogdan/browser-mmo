<template>
  <v-dialog :model-value="modelValue" max-width="420" @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="warning" class="mr-2">mdi-store</v-icon>
        {{ subLocation?.name }}
      </v-card-title>
      <v-card-subtitle v-if="subLocation?.description">{{ subLocation.description }}</v-card-subtitle>
      <v-card-text>
        <v-alert type="info" variant="tonal" density="compact">
          Trading isn't open yet — come back later to buy and sell gear here.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { SubLocationCell } from '~/stores/world';

defineProps<{
  modelValue: boolean;
  subLocation: SubLocationCell | null;
}>();

defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>
