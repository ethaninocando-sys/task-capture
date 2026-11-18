import { useCallback, useEffect, useRef, useState } from 'react'
import { inMacApp, tellMac } from '../lib/native'
import type { Area } from '../lib/options'
import { supabase } from '../lib/supabase'
import { AddTaskForm } from './AddTaskForm'
import { AreaEditor } from './AreaEditor'
import { Modal } from './Modal'

declare global {
  interface Window {
    /**
     * Called by the Mac app every time the popup opens. Puts the cursor back in the text box and
     * keeps whatever you left unsent. The form only starts blank after Add task or Cancel/Esc.
     */
    taskCaptureReset?: () => void
  }
}

/** The ⌥Space quick-add window: just the add-task form, nothing else. */
export function PopupCapture() {
  const [areas, setAreas] = useState<Area[]>([])
  const [taskCounts, setTaskCounts] = useState(new Map<string, number>())
  const [formKey, setFormKey] = useState(0)
  const [editingAreas, setEditingAreas] = useState(false)
  const [added, setAdded] = useState(false)
  const addedRef = useRef(false) // true right after Add task, so the next open starts blank

  const loadAreas = useCallback(async () => {
    const [areaRows, taskRows] = await Promise.all([
      supabase.from('areas').select('id, name, position').order('position').order('created_at'),
      supabase.from('tasks').select('area_id'),
    ])
    if (areaRows.data) setAreas(areaRows.data as Area[])
    if (taskRows.data) {
      const counts = new Map<string, number>()
      for (const t of taskRows.data as { area_id: string | null }[])
        if (t.area_id) counts.set(t.area_id, (counts.get(t.area_id) ?? 0) + 1)
      setTaskCounts(counts)
    }
  }, [])

  const close = useCallback(() => {
    if (inMacApp) tellMac({ type: 'close' })
  }, [])

  // Cancel / Esc: throw the draft away, then hide.
  const discard = useCallback(() => {
    setFormKey((k) => k + 1)
    close()
  }, [close])

  useEffect(() => {
    void loadAreas()
    window.taskCaptureReset = () => {
      setEditingAreas(false)
      // After a task was added, start fresh. Otherwise keep the unsent draft.
      if (addedRef.current) {
        addedRef.current = false
        setAdded(false)
        setFormKey((k) => k + 1)
      }
      void loadAreas()
      setTimeout(() => {
        const box = document.getElementById('task-title') as HTMLTextAreaElement | null
        if (!box) return
        box.focus()
        box.setSelectionRange(box.value.length, box.value.length) // cursor at the end, ready to keep going
      }, 30)
    }
    // Esc closes the popup, unless an inner pop-up (Edit areas) is open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role=dialog]')) discard()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      delete window.taskCaptureReset
      window.removeEventListener('keydown', onKey)
    }
  }, [loadAreas, discard])

  return (
    <main className="min-h-dvh bg-bg p-5">
      {added ? (
        <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col items-center justify-center gap-2 text-center" role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 12 12" className="size-6" aria-hidden>
              <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="font-medium">Task added</p>
          {!inMacApp && (
            <button type="button" onClick={() => window.taskCaptureReset?.()} className="text-sm text-muted underline">
              Add another
            </button>
          )}
        </div>
      ) : (
        <AddTaskForm
          key={formKey}
          areas={areas}
          onEditAreas={() => setEditingAreas(true)}
          onCancel={discard}
          onAdded={() => {
            addedRef.current = true
            setAdded(true)
            // Show the check mark for a moment, then get out of the way.
            setTimeout(close, 450)
          }}
        />
      )}

      {editingAreas && (
        <Modal label="Edit your areas" onClose={() => setEditingAreas(false)}>
          <AreaEditor
            areas={areas}
            taskCounts={taskCounts}
            onChanged={loadAreas}
            onDone={() => setEditingAreas(false)}
          />
        </Modal>
      )}
    </main>
  )
}
