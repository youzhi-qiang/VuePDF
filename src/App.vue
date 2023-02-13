<template>
    <div :style="`text-align: center`" v-for="i in pages" >
      <VuePDF :pdf="pdf" :page="i" lazy-load text-layer >
        <div style="text-align: center;">
          Loading... 
        </div>
      </VuePDF>
    </div>
    <!-- <div :style="`text-align: center`" >
      <VuePDF :pdf="pdf" :page="1" :scale="2" text-layer annotation-layer>
        <div style="text-align: center;">
          Loading... 
        </div>
      </VuePDF>
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