import { ViewMode } from '../types'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('list')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'list'
            ? 'bg-white text-primary-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-label="List view"
      >
        List
      </button>
      <button
        onClick={() => onViewModeChange('agenda')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'agenda'
            ? 'bg-white text-primary-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-label="Agenda view"
      >
        Agenda
      </button>
    </div>
  )
}








