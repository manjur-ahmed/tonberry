function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-7 w-16 flex-shrink-0 overflow-hidden rounded-full transition-colors ${
        checked ? 'bg-slate-900' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute inset-y-0 left-2 flex items-center text-[10px] font-bold tracking-wide text-white transition-opacity ${
          checked ? 'opacity-100' : 'opacity-0'
        }`}
      >
        ON
      </span>
      <span
        className={`absolute inset-y-0 right-2 flex items-center text-[10px] font-bold tracking-wide text-slate-500 transition-opacity ${
          checked ? 'opacity-0' : 'opacity-100'
        }`}
      >
        OFF
      </span>
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-9' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default Switch
