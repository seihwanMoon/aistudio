import { KO } from '../constants/korean'

export default function UploadPage() {
  return (
    <section>
      <h1>{KO.upload.title}</h1>
      <p>{KO.upload.subtitle}</p>
      <small>{KO.upload.supportedFormats}</small>
    </section>
  )
}
