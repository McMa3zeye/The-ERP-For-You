import { memo, useMemo, useRef, useEffect, useState } from 'react'

/**
 * Lightweight Virtual List Component for large datasets
 * Only renders visible items to improve performance
 */
const VirtualList = memo(function VirtualList({ 
  items = [], 
  renderItem, 
  itemHeight = 50, 
  containerHeight = 400,
  overscan = 3 // Render extra items above/below viewport
}) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const end = Math.ceil((scrollTop + containerHeight) / itemHeight)
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end + overscan)
    }
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan])

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index
    }))
  }, [items, visibleRange.start, visibleRange.end])

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop)
  }

  // Total height of all items
  const totalHeight = items.length * itemHeight
  // Offset for visible items
  const offsetY = visibleRange.start * itemHeight

  if (items.length === 0) {
    return (
      <div style={{ height: containerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-200)' }}>
        No items to display
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative'
      }}
    >
      {/* Spacer for items before visible range */}
      <div style={{ height: offsetY }} />
      
      {/* Visible items */}
      {visibleItems.map(({ item, index }) => (
        <div
          key={index}
          style={{
            height: itemHeight,
            position: 'relative'
          }}
        >
          {renderItem(item, index)}
        </div>
      ))}
      
      {/* Spacer for items after visible range */}
      <div style={{ height: Math.max(0, totalHeight - offsetY - (visibleItems.length * itemHeight)) }} />
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.items === nextProps.items &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.containerHeight === nextProps.containerHeight &&
    prevProps.renderItem === nextProps.renderItem
  )
})

VirtualList.displayName = 'VirtualList'

export default VirtualList

