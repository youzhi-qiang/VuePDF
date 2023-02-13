<template>
  <span ref="ContainerREF" style="position: relative; display: flex;">
    <canvas ref="CanvasREF" style="display: inline-block"></canvas>
    <div ref="AnnotationlayerREF" class="annotationLayer" style="display: block;" v-show="annotationLayer"></div>
    <div ref="TextlayerREF" class="textLayer" style="display: block;" v-show="textLayer"></div>
    <div ref="LoadlayerREF" style="display: block; position: absolute;" v-show="loading">
      <slot></slot>
    </div>
  </span>
</template>

<script>
import * as PDFJSLib from "pdfjs-dist/build/pdf"
import * as PDFJSViewer from "pdfjs-dist/web/pdf_viewer"
import { SimpleLinkService } from "pdfjs-dist/web/pdf_viewer"
import "pdfjs-dist/web/pdf_viewer.css"

import { watch, ref, onMounted, onUnmounted } from 'vue'

import {
  EVENTS_TO_HANDLER,
  inputAnnotationHandler,
  fileAnnotationHandler,
  linkAnnotationHandler,
  getAnnotationsByKey
} from "./utils/widgets";


export default {
  name: 'VuePDF',
  emits: [
    'annotation',
    'loaded'
  ],
  props: {
    pdf: {
      required: true
    },
    page: {
      type: Number,
      default: 1
    },
    scale: {
      type: Number,
      default: 1
    },
    rotation: Number,
    "fit-parent": Boolean,
    "lazy-load": Boolean,
    "annotations-filter": Array,
    "text-layer": Boolean,
    "annotation-layer": Boolean
  },
  setup(props, context) {
    // Template elements
    const CanvasREF = ref({})
    const TextlayerREF = ref({})
    const AnnotationlayerREF = ref({})
    const ContainerREF = ref({})
    const LoadlayerREF = ref({})

    // Another vars
    const loading = ref(true)
    const canload = ref(false)

    // PDF's global objects
    let PDFDoc = null
    let PageRender = null
    let PageContext = null
    let TextLayerLoaded = false
    let AnnotationLayerLoaded = false
    let FieldObjects = {}
    let Annotations = []

    const emitLoaded = (data) => {
      context.emit("loaded", data)
    }

    const emitAnnotation = (data) => {
      context.emit("annotation", data)
    }

    const annotationEventsHandler = (evt) => {
      var annotation = evt.target.parentNode
      // annotations are <section> elements if div returned find in child nodes the section element
      if (annotation.tagName === "DIV") {
        annotation = annotation.firstChild
      }
      // LINK ANNOTATIONS - EVENTS: [click]
      if (annotation.className === "linkAnnotation" && evt.type === "click") {
        const id = annotation.dataset["annotationId"]
        if (id) emitAnnotation(linkAnnotationHandler(getAnnotationsByKey("id", id, Annotations)[0], PDFDoc))
      // POPUP ANNOTATIONS - EVENTS: [dblclick]
      } else if (
        annotation.className === "popupAnnotation" ||
        annotation.className === "textAnnotation" ||
        annotation.className === "fileAttachmentAnnotation"
      ) {
        // parse popup content using dataset
        for (const spanElement of annotation.getElementsByTagName("span")) {
          var content = spanElement.textContent
          var args = JSON.parse(spanElement.dataset["l10nArgs"])
          for (const key in args) content = content.replace(`{{${key}}}`, args[key])
          spanElement.textContent = content
        }
        if (
          annotation.className === "fileAttachmentAnnotation" &&
          evt.type === "dblclick"
        ) {
          const id = annotation.dataset["annotationId"]
          if (id) emitAnnotation(fileAnnotationHandler(getAnnotationsByKey("id", id, Annotations)[0]))
        }
      // TEXT WIDGET ANNOTATIONS - EVENTS: [input]
      } else if (
        annotation.className === "textWidgetAnnotation" &&
        evt.type === "input"
      ) {
        let inputElement = annotation.getElementsByTagName("input")[0]
        if (!inputElement)
          inputElement = annotation.getElementsByTagName("textarea")[0]
        emitAnnotation(inputAnnotationHandler(inputElement))
      // CHOICE WIDGET ANNOTATIONS - EVENTS: [input]
      } else if (
        annotation.className === "choiceWidgetAnnotation" &&
        evt.type === "input"
      ) {
        emitAnnotation(inputAnnotationHandler(annotation.getElementsByTagName("select")[0]))
      // CHECKBOX WIDGET ANNOTATIONS - EVENTS: [change]
      } else if (
        annotation.className === "buttonWidgetAnnotation checkBox" &&
        evt.type === "change"
      ) {
        emitAnnotation(inputAnnotationHandler(annotation.getElementsByTagName("input")[0]))
      // RADIO WIDGET ANNOTATIONS - EVENTS: [change]
      } else if (
        annotation.className === "buttonWidgetAnnotation radioButton" &&
        evt.type === "change"
      ) {
        const id = annotation.dataset["annotationId"]
        if (id) {
          const anno = getAnnotationsByKey("id", id, Annotations)[0]
          const radioOptions = []
          for (const radioAnnotations of getAnnotationsByKey(
            "fieldName",
            anno.fieldName,
            Annotations
          ))
            if (radioAnnotations.buttonValue)
              radioOptions.push(radioAnnotations.buttonValue)
          emitAnnotation(inputAnnotationHandler(annotation.getElementsByTagName("input")[0], {
            value: anno.buttonValue,
            defaultValue: anno.fieldValue,
            options: radioOptions
          }))
        }
      // BUTTON WIDGET ANNOTATIONS - EVENTS: [click]
      } else if (
        annotation.className === "buttonWidgetAnnotation pushButton" &&
        evt.type === "click"
      ) {
        const id = annotation.dataset["annotationId"]
        if (id) {
          const anno = getAnnotationsByKey("id", id, Annotations)[0]
          if (!anno.resetForm)
            emitAnnotation(inputAnnotationHandler(
              { name: anno.fieldName, type: "button" },
              { actions: anno.actions, reset: false }
            ))
          else
            emitAnnotation(inputAnnotationHandler(
              { name: anno.fieldName, type: "button" },
              { actions: anno.actions, reset: true }
            ))
        }
      }
    }

    const isInViewport = () => {
      if (ContainerREF.value && PageRender) {
        const bounds = ContainerREF.value.getBoundingClientRect()
        if ((bounds.y > 0 && bounds.y < window.innerHeight) && !canload.value) {
          console.log(`rendering ${props.page}`);
          displayPage()
        };

      }
    }

    const displayPage = () => {
      canload.value = true
      let emitLoadedEvent = false
      let viewport = PageContext.viewport
      let page = PageRender

      // Set timeout to avoid a browser stuck when page render 
      setTimeout(() => {
        page.render(PageContext).promise.then(() => {
          loading.value = false
          // Load text layer if prop is true
          if (props.textLayer) {
            page.getTextContent().then(textContent => {
              // TextlayerREF.value.style.left = CanvasREF.value.offsetLeft + 'px';
              // TextlayerREF.value.style.top = CanvasREF.value.offsetTop + 'px';
              TextlayerREF.value.style.height = CanvasREF.value.offsetHeight + 'px';
              TextlayerREF.value.style.width = CanvasREF.value.offsetWidth + 'px';

              // Render text using TextLayerBuilder from pdfjs viewer
              const TextLayerBuilder = new PDFJSViewer.TextLayerBuilder({
                textLayerDiv: TextlayerREF.value,
                pageIndex: page._pageIndex,
                eventBus: new PDFJSViewer.EventBus(),
                viewport: viewport,
                enhanceTextSelection: false
              })
              TextLayerBuilder.setTextContent(textContent)
              TextLayerBuilder.render();
              TextLayerLoaded = true
            })
          }

          // Load annotaion layer if prop is true
          if (props.annotationLayer) {
            emitLoadedEvent = true
            page.getAnnotations().then(annotations => {
              // AnnotationlayerREF.value.style.left = CanvasREF.value.offsetLeft + 'px';
              // AnnotationlayerREF.value.style.top = CanvasREF.value.offsetTop + 'px';
              AnnotationlayerREF.value.style.height = CanvasREF.value.offsetHeight + 'px';
              AnnotationlayerREF.value.style.width = CanvasREF.value.offsetWidth + 'px';
              if (props.annotationsFilter) {
                annotations = annotations.filter(value => {
                  const filters = props.annotationsFilter
                  const subType = value.subtype
                  const fieldType = value.fieldType ? `${subType}.${value.fieldType}` : null

                  return filters.includes(subType) || filters.includes(fieldType)
                })
              }

              // Canvas map for push button widget
              const canvasMap = new Map([])
              for (const anno of annotations) {
                if (anno.subtype === "Widget" && anno.fieldType === "Btn" && anno.pushButton) {
                  const subCanvas = document.createElement("canvas")
                  subCanvas.setAttribute("width", (anno.rect[2] - anno.rect[0]) * viewport.scale)
                  subCanvas.setAttribute("height", (anno.rect[3] - anno.rect[1]) * viewport.scale)
                  canvasMap.set(anno.id, subCanvas)
                }
              }
              PDFJSLib.AnnotationLayer.render({
                annotations: annotations,
                viewport: viewport.clone({ dontFlip: true }),
                page: page,
                linkService: new SimpleLinkService(), // no pdfviewer features needed, send void LinkService
                div: AnnotationlayerREF.value,
                enableScripting: true,
                hasJSActions: true,
                annotationCanvasMap: canvasMap,
                fieldObjects: FieldObjects
              })

              Annotations = annotations
              AnnotationLayerLoaded = true
              emitLoaded({ ...viewport, annotations: annotations })

              // Add event listeners to manage some events of annotations layer items
              for (const evtHandler of EVENTS_TO_HANDLER)
                AnnotationlayerREF.value.addEventListener(evtHandler, annotationEventsHandler)
            })
          }
          if (!emitLoadedEvent)
            emitLoaded(viewport)
        })
      }, 10);
    }

    const renderPage = (pageNum) => {
      PDFDoc.getPage(pageNum).then(page => {
        let fscale = props.scale
        if (props.fitParent) {
          const parentWidth = ContainerREF.value.parentNode.clientWidth
          const scale1Width = page.getViewport({ scale: 1 }).width
          fscale = parentWidth / scale1Width
        }

        const viewportParams = {
          scale: fscale
        }

        // Set rotation param only if is a valid number
        if (typeof props.rotation === "number" && props.rotation % 90 === 0)
          viewportParams['rotation'] = props.rotation + page.getViewport({ scale: 1 }).rotation

        var viewport = page.getViewport(viewportParams);
        var ctx = CanvasREF.value.getContext('2d')

        CanvasREF.value.width = viewport.width;
        CanvasREF.value.height = viewport.height;
        CanvasREF.value.style.width = viewport.width + 'px';
        CanvasREF.value.style.height = viewport.height + 'px';
        LoadlayerREF.value.width = viewport.width;
        LoadlayerREF.value.style.width = viewport.width + 'px';

        // Set page task and viewport params in global component variables
        PageContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        PageRender = page

        if (!props.lazyLoad) {
          displayPage()
        } else {
          isInViewport()
        }
      })
    }

    const clearLayers = () => {
      // Clear all childnodes of layer elements
      TextlayerREF.value.replaceChildren?.()
      AnnotationlayerREF.value.replaceChildren?.()
      // Clear event listeners of annotation layer 
      for (const evtHandler of EVENTS_TO_HANDLER)
        AnnotationlayerREF.value.removeEventListener?.(evtHandler, annotationEventsHandler)
    }

    const initDoc = (proxy) => {
      proxy.promise.then(doc => {
        PDFDoc = doc
        PDFDoc.getFieldObjects().then(data => {
          FieldObjects = data
        })
        renderPage(props.page)
      })
    }

    watch(() => props.pdf, (pdf) => {
      // for any change in pdf proxy, rework all
      if (pdf !== undefined) {
        clearLayers()
        initDoc(pdf)
      }
    })

    watch(() => props.textLayer, (textLayer) => {
      if (textLayer) {
        // If text-layer has no been loaded before, rework the render task
        if (!TextLayerLoaded) {
          renderPage(props.page)
        }
      }
    })

    watch(() => props.annotationLayer, (annotationLayer) => {
      if (annotationLayer) {
        // If annotation-layer has no been loaded before, rework the render task
        if (!AnnotationLayerLoaded) {
          renderPage(props.page)
        }
      }
    })

    // WHhen annotations filter change rework render task
    watch(() => props.annotationsFilter, () => {
      clearLayers()
      renderPage(props.page)
    })

    watch(() => props.scale, (_) => {
      // When scale change rework render task
      clearLayers()
      renderPage(props.page)
    })

    watch(() => props.rotation, (_) => {
      // When rotation change rework render task
      clearLayers()
      renderPage(props.page)
    })

    watch(() => props.page, (page) => {
      // When page change rework render task
      clearLayers()
      renderPage(page)
    })

    onMounted(() => {
      if (props.lazyLoad){
        document.addEventListener('scroll', isInViewport)
      }
      if (props.pdf !== undefined) {
        initDoc(props.pdf)
      }
    })
    
    onUnmounted(() => {
      if (props.lazyLoad){
        document.removeEventListener('scroll', isInViewport)
      }
    })

    // Public methods
    const reload = () => {
      clearLayers()
      renderPage(props.page)
    }

    return {
      CanvasREF,
      TextlayerREF,
      AnnotationlayerREF,
      ContainerREF,
      LoadlayerREF,
      loading,
      reload
    }
  }


};
</script>

<style>
.annotationLayer {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}

/* Make annotation sections available over text layer */
.annotationLayer section {
  z-index: 1;
}
</style>
