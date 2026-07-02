// Unified action sheet: native iOS/Android sheet inside Despia, styled web fallback in the browser.
//
// One API everywhere:
//   const showSheet = useActionSheet()
//   showSheet({
//     title: 'Post options',
//     items: [
//       { label: 'Edit',   value: 'edit',   iconIos: 'pencil', iconAndroid: 'edit' },
//       { label: 'Delete', value: 'delete', iconIos: 'trash',  iconAndroid: 'delete', destructive: true },
//     ],
//     onSelect: (value) => { ... },   // value === null when dismissed
//   })
//
// On device it calls despia('actionsheet://...') and wires the single global
// window.onSheetEvent hook. In the browser it opens a bottom drawer with the same items.
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import despia from 'despia-native'
import { isNative } from '@/lib/deviceAuth'
import { haptics } from '@/lib/haptics'
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

const ActionSheetContext = createContext(null)

function nativeSheet({ title, items, theme = 'system', onSelect }) {
  // window.onSheetEvent is a single global hook — reassign right before each call.
  window.onSheetEvent = (value) => {
    if (value !== null) haptics.light()
    onSelect?.(value)
  }
  const params = new URLSearchParams({
    ...(title ? { title } : {}),
    items: JSON.stringify(items),
    theme,
  }).toString()
  despia(`actionsheet://?${params}`)
}

export function ActionSheetProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState(null)
  const resolvedRef = useRef(false)

  const finish = useCallback((value) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (value !== null) haptics.light()
    config?.onSelect?.(value)
  }, [config])

  const showSheet = useCallback((cfg) => {
    if (isNative()) {
      nativeSheet(cfg)
      return
    }
    resolvedRef.current = false
    setConfig(cfg)
    setOpen(true)
  }, [])

  const handleSelect = (value) => {
    finish(value)
    setOpen(false)
  }

  return (
    <ActionSheetContext.Provider value={showSheet}>
      {children}
      <Drawer
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) finish(null) // dismissed by tapping outside / dragging down
        }}
      >
        <DrawerContent className="pb-safe-bottom">
          {config?.title && (
            <DrawerHeader>
              <DrawerTitle>{config.title}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="flex flex-col gap-1 px-4">
            {config?.items?.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleSelect(item.value)}
                className={`w-full text-left rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted ${
                  item.destructive ? 'text-destructive' : 'text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => handleSelect(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </ActionSheetContext.Provider>
  )
}

export function useActionSheet() {
  const ctx = useContext(ActionSheetContext)
  if (!ctx) throw new Error('useActionSheet must be used within <ActionSheetProvider>')
  return ctx
}