const INTERNAL_LINK = "internal-link"
const LINK = "link"
const FILE_ATTACHMENT = "file-attachment"
const FORM_TEXT = "form-text"
const FORM_SELECT = "form-select"
const FORM_CHECKBOX = "form-checkbox"
const FORM_RADIO = "form-radio"
const FORM_BUTTON = "form-button"

const EVENTS_TO_HANDLER = ["click", "dblclick", "mouseover", "input", "change"]

const inputAnnotationHandler = (inputEl, args) => {
  switch (inputEl.type) {
    case "textarea":
    case "text":
      return buildAnnotationData(FORM_TEXT, {
        fieldName: inputEl.name,
        value: inputEl.value
      })
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
      return buildAnnotationData(FORM_SELECT, {
        fieldName: inputEl.name,
        value: selected,
        options: options
      })
    case "checkbox":
      return buildAnnotationData(FORM_CHECKBOX, {
        fieldName: inputEl.name,
        checked: inputEl.checked
      })
    case "radio":
      return buildAnnotationData(FORM_RADIO, {
        fieldName: inputEl.name,
        ...args
      })
    case "button":
      return buildAnnotationData(FORM_BUTTON, {
        fieldName: inputEl.name,
        ...args
      })
    default:
      break
  }
}

const fileAnnotationHandler = (annotation) =>
  buildAnnotationData(FILE_ATTACHMENT, annotation.file)

const linkAnnotationHandler = (annotation, PDFDoc) => {
  if (annotation.dest) {
    // Get referenced page number of internal link
    PDFDoc.getPageIndex(annotation.dest[0]).then((pageIndex) => {
      const eventInfo = {
        referencedPage: pageIndex + 1,
        offset: {
          left: annotation.dest[2],
          bottom: annotation.dest[3]
        }
      }
      return buildAnnotationData(INTERNAL_LINK, eventInfo)
    })
  } else if (annotation.url) {
    const eventInfo = {
      url: annotation.url,
      unsafeUrl: annotation.unsafeUrl
    }
    return buildAnnotationData(LINK, eventInfo)
  }
}

const getAnnotationsByKey = (key, value, annos) => {
  const result = []
  for (const annotation of annos)
    if (annotation[key] === value) result.push(annotation)
  return result
}

const buildAnnotationData = (type, data) => {
  return { type: type, data: data }
}

export { 
  getAnnotationsByKey,
  inputAnnotationHandler,
  fileAnnotationHandler,
  linkAnnotationHandler, 
  EVENTS_TO_HANDLER
}
