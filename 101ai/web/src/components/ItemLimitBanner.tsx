import { Link } from 'react-router-dom'

function ItemLimitBanner() {
  return (
    <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      Couldn't save item as you've ran out of space.{' '}
      <Link to="/pricing?reason=items" className="underline">
        Upgrade for unlimited items
      </Link>
    </p>
  )
}

export default ItemLimitBanner
