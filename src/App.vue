<template>
    <div :style="`text-align: center`" v-for="i in [2, 1, 4, 5, 3]" >
      <VuePDF :pdf="pdf" :page="i"  />
    </div>
    <!-- <div :style="`text-align: center`" >
      <VuePDF :pdf="pdf" :page="1"  />
    </div> -->
</template>

<script>

import {ref, watch} from 'vue'
import usePDF from "./components/usePDF";
import VuePDF from "./components/VuePDF.vue";

export default {
  components: {
    VuePDF
  },
  setup(){
  
    const {pdf, pages} = usePDF("large.pdf")
  
    return {
      pdf,
      pages
    }
  }

}
</script>

<style>

</style>