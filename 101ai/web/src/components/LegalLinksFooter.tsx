import { Link } from 'react-router-dom'

// Google Play's app-review requirements are what actually forced this
// into existence — every page a user could plausibly sign up or pay from
// needs a visible link to both documents, not just the pages themselves
// existing somewhere in the app.
function LegalLinksFooter() {
  return (
    <p className="relative mt-4 text-center text-sm text-slate-500">
      <Link to="/terms" className="underline">
        Terms of Service
      </Link>{' '}
      and{' '}
      <Link to="/privacy" className="underline">
        Privacy Policy
      </Link>
    </p>
  )
}

export default LegalLinksFooter
