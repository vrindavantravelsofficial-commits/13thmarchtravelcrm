'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ImageUpload({ label, value, onChange }) {
  const [preview, setPreview] = useState(value)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
        onChange(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="Preview" className="max-h-32 rounded-lg mx-auto" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 w-6 h-6"
              onClick={(e) => { e.stopPropagation(); handleRemove() }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="py-4">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload</p>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
