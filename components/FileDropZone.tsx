'use client'
import { useState, useCallback, useId } from 'react'

interface FileDropZoneProps {
  onText: (text: string) => void
  disabled?: boolean
  append?: boolean
}

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function FileDropZone({ onText, disabled, append = false }: FileDropZoneProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const inputId = useId()

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true)
    setFileCount(list.length)
    try {
      for (const file of list) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/parse-doc', { method: 'POST', body: fd })
        const data = await res.json()
        if (res.ok) onText(data.text)
        else alert(data.error || `Could not read ${file.name}`)
      }
    } finally {
      setUploading(false)
      setFileCount(0)
    }
  }, [onText])

  const isDisabled = disabled || uploading

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (isDisabled) return
    const files = e.dataTransfer.files
    if (files.length) processFiles(files)
  }, [isDisabled, processFiles])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDisabled) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'rounded-md border-2 border-dashed px-4 py-3 transition-colors',
        isDisabled
          ? 'border-gray-200 bg-gray-50'
          : dragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50',
      ].join(' ')}
    >
      {/* hidden real file input */}
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        disabled={isDisabled}
        onChange={async (e) => {
          if (e.target.files?.length) {
            await processFiles(e.target.files)
            e.target.value = ''
          }
        }}
      />

      {uploading ? (
        <p className="text-center text-xs font-medium text-blue-700">
          {fileCount > 1 ? `Reading ${fileCount} files…` : 'Reading file…'}
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <label
            htmlFor={inputId}
            className={[
              'inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors',
              isDisabled
                ? 'cursor-not-allowed border-gray-200 text-gray-400'
                : 'cursor-pointer border-blue-400 text-blue-700 hover:bg-blue-100',
            ].join(' ')}
          >
            <span>⬆</span>
            <span>Click to upload</span>
          </label>

          <span className="text-xs text-gray-400">or</span>

          <span className={`text-xs font-medium ${dragging ? 'text-blue-700' : 'text-gray-500'}`}>
            {dragging ? 'Drop files here' : 'drag & drop PDF / Word — multiple files OK'}
          </span>
        </div>
      )}
    </div>
  )
}
