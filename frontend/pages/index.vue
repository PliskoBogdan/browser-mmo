<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
await navigateTo('/world');
</script>
