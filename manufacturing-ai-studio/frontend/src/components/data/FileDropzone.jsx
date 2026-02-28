import { useDropzone } from 'react-dropzone'

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

export default function FileDropzone({ file, onFileSelect, disabled }) {
  const onDrop = (acceptedFiles) => {
    const nextFile = acceptedFiles?.[0] || null
    onFileSelect(nextFile)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: MAX_FILE_SIZE,
    accept: ACCEPT,
    disabled,
  })

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${isDragActive ? '#3b82f6' : '#d1d5db'}`,
        borderRadius: 12,
        padding: '24px 16px',
        backgroundColor: isDragActive ? '#eff6ff' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input {...getInputProps()} />
      <p style={{ margin: 0, fontWeight: 700 }}>
        {isDragActive ? '파일을 놓으면 업로드 준비가 완료됩니다' : '파일을 여기로 끌어다 놓거나 클릭해 선택하세요'}
      </p>
      <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
        지원 형식: .csv, .xlsx (최대 50MB)
      </p>
      {file && (
        <p style={{ margin: '10px 0 0', color: '#111827' }}>
          선택 파일: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
        </p>
      )}
    </div>
  )
}
