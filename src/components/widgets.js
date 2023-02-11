const INTERNAL_LINK = "internal-link"
const LINK = "link"
const FILE_ATTACHMENT = "file-attachment"
const FORM_TEXT = "form-text"
const FORM_SELECT = "form-select"
const FORM_CHECKBOX = "form-checkbox"
const FORM_RADIO = "form-radio"
const FORM_BUTTON = "form-button"

const EVENTS_TO_HANDLER = ['click', 'dblclick', 'mouseover', 'input', 'change']

let Annotations = null
let ctx = null



const annotationEventsHandler = (annos, context, evt) => {
    Annotations = annos
    ctx = context

    var annotation = evt.target.parentNode;
    // annotations are <section> elements if div returned find in child nodes the section element
    // TODO this part in recursive mode 
    if (annotation.tagName === 'DIV'){
      annotation = annotation.firstChild
    }
    // For linkAnnotation events get only click events
    if (annotation.className === 'linkAnnotation' && evt.type === 'click') {
      const id = annotation.dataset['annotationId']
      if (id) linkAnnotationHandler(getAnnotationsByKey('id', id)[0])
    // For popups annotations 
    } else if (annotation.className === 'popupAnnotation' || annotation.className === 'textAnnotation' || annotation.className === 'fileAttachmentAnnotation'){
      for (const spanElement of annotation.getElementsByTagName("span")) {
        var content = spanElement.textContent
        var args = JSON.parse(spanElement.dataset['l10nArgs'])
        for (const key in args) 
            content = content.replace(`{{${key}}}`, args[key])
        spanElement.textContent = content
      }
      if (annotation.className === 'fileAttachmentAnnotation' && evt.type === 'dblclick'){
        const id = annotation.dataset['annotationId']
        if (id) fileAnnotationHandler(getAnnotationsByKey('id', id)[0])
      }
    // TextFields and TextAreas
    } else if (annotation.className === 'textWidgetAnnotation' && evt.type === 'input') {
      let inputElement = annotation.getElementsByTagName("input")[0]
      if (!inputElement) inputElement = annotation.getElementsByTagName("textarea")[0]
      inputAnnotationHandler(inputElement)
    
    } else if (annotation.className === 'choiceWidgetAnnotation' && evt.type === 'input') {
      inputAnnotationHandler(annotation.getElementsByTagName("select")[0])
    } else if (annotation.className === 'buttonWidgetAnnotation checkBox' && evt.type === 'change') {
      inputAnnotationHandler(annotation.getElementsByTagName("input")[0])
    } else if (annotation.className === 'buttonWidgetAnnotation radioButton' && evt.type === 'change') {
      const id = annotation.dataset['annotationId']
      if (id){
        const anno = getAnnotationsByKey('id', id)[0]
        const radioOptions = []
        for (const radioAnnotations of getAnnotationsByKey('fieldName', anno.fieldName)) 
          if (radioAnnotations.buttonValue) radioOptions.push(radioAnnotations.buttonValue)
        inputAnnotationHandler(annotation.getElementsByTagName("input")[0], {
          value: anno.buttonValue,
          defaultValue: anno.fieldValue,
          options: radioOptions
        })
      }
    } else if (annotation.className === 'buttonWidgetAnnotation pushButton' && evt.type === 'click'){
      const id = annotation.dataset['annotationId']
      if (id){
        const anno = getAnnotationsByKey('id', id)[0]
        if (!anno.resetForm)
          inputAnnotationHandler({name: anno.fieldName, type: "button"}, {actions: anno.actions, reset: false})
        else
          inputAnnotationHandler({name: anno.fieldName, type: "button"}, {actions: anno.actions, reset: true})
      }  
    }
    // Another Annotations manage here
  }

  const inputAnnotationHandler = (inputEl, args) => {
    switch (inputEl.type) {
      case "textarea":
      case "text":
        emitAnnotation(FORM_TEXT, {
          fieldName: inputEl.name,
          value: inputEl.value
        })
        break;
      case "select-one":
      case "select-multiple":
        const options = []
        for (const opt of inputEl.options) {
          options.push({
            value: opt.value,
            label: opt.label
          })
        }
        const selected = []
        for (const opt of inputEl.selectedOptions) {
          selected.push({
            value: opt.value,
            label: opt.label
          })
        }
        emitAnnotation(FORM_SELECT, {
          fieldName: inputEl.name,
          value: selected,
          options: options
        })
        break;
      case "checkbox":
        emitAnnotation(FORM_CHECKBOX, {
          fieldName: inputEl.name,
          checked: inputEl.checked
        })
        break;
      case "radio":
        emitAnnotation(FORM_RADIO, {
          fieldName: inputEl.name,
          ...args,
        })
        break;
      case "button":
        emitAnnotation(FORM_BUTTON,  {
          fieldName: inputEl.name,
          ...args,
        })
      default:
        break;
    }
  }

  const fileAnnotationHandler = (annotation) => 
    emitAnnotation(FILE_ATTACHMENT, annotation.file)
  

  const linkAnnotationHandler = (annotation) => {
    if (annotation.dest){
      // Get referenced page number of internal link
      PDFDoc.getPageIndex(annotation.dest[0]).then(pageIndex => {
        const eventInfo = {
          referencedPage: pageIndex + 1,
          offset: {
            left: annotation.dest[2],
            bottom: annotation.dest[3]
          }
        }
        emitAnnotation(INTERNAL_LINK, eventInfo)
      })
    }else if (annotation.url){
      const eventInfo = {
        url: annotation.url,
        unsafeUrl: annotation.unsafeUrl
      }
      emitAnnotation(LINK, eventInfo)
    }
  }

  const getAnnotationsByKey = (key, value) => {
    const result = []
    for (const annotation of Annotations) 
      if (annotation[key] === value) result.push(annotation)
    return result
  }

  const emitAnnotation = (type, data) => {
    ctx.emit("annotation", {type: type, data: data})
  }



export {
    annotationEventsHandler,
    EVENTS_TO_HANDLER
}