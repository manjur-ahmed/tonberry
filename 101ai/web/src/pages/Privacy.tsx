import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const LAST_UPDATED = '18 September 2026'
const CONTACT_EMAIL = 'manjurchowdhury1@gmail.com'

// Not incorporated as a company yet — "Tonberry" below is an individual
// trading under that name, not a limited company. Update this (and the
// "Who we are" section) once a formal entity exists.
const OPERATOR_NAME = 'Tonberry'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

function Privacy() {
  const navigate = useNavigate()

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-900">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-400">Last updated: {LAST_UPDATED}</p>

      <Section title="1. Who we are">
        <p>
          This Privacy Policy explains how {OPERATOR_NAME} ("we", "us", "our") collects, uses, and protects your
          information when you use the 101 AI Tools application and website (the "Service"). If you have questions,
          contact us at {CONTACT_EMAIL}.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p>We collect:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-slate-700">Account information</span> — your name, email address, and
            (if you sign in with Google) the basic profile details Google shares with us.
          </li>
          <li>
            <span className="font-medium text-slate-700">Content you provide</span> — messages you send, files or
            images you upload, and anything you save as an item, across any tool.
          </li>
          <li>
            <span className="font-medium text-slate-700">Location</span> — only if you choose to share it for a tool
            that uses it (e.g. Steps Planner), or the general area needed to make a tool's suggestions relevant.
          </li>
          <li>
            <span className="font-medium text-slate-700">Usage and device information</span> — things like your
            browser/device type, general region, pages and features used, and error/crash reports, collected
            automatically as you use the Service.
          </li>
        </ul>
      </Section>

      <Section title="3. How we use your information">
        <p>We use the information above to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide and operate the Service, including generating the AI responses you ask for</li>
          <li>Maintain your account and keep the Service secure</li>
          <li>Understand how the Service is used, and to find and fix problems</li>
          <li>Communicate with you about your account or the Service</li>
        </ul>
      </Section>

      <Section title="4. Who we share it with">
        <p>We don't sell your personal information. We share it only with:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-slate-700">AI service providers</span>, to generate the responses,
            plans, and other content the Service produces
          </li>
          <li>
            <span className="font-medium text-slate-700">Cloud hosting and infrastructure providers</span>, to run
            and store the Service and its data
          </li>
          <li>
            <span className="font-medium text-slate-700">Authentication providers</span>, if you choose to sign in
            with Google
          </li>
          <li>
            <span className="font-medium text-slate-700">Analytics and monitoring providers</span>, to help us
            understand usage and catch errors
          </li>
        </ul>
        <p>
          Each of these only receives what it needs to do its job, and we expect them to protect your information
          appropriately. We may also share information if required by law.
        </p>
      </Section>

      <Section title="5. Cookies and similar technologies">
        <p>
          We use cookies and similar technologies to keep you signed in and to understand how the Service is used.
          You can control cookies through your browser settings, though some parts of the Service may not work
          properly without them.
        </p>
      </Section>

      <Section title="6. Data retention">
        <p>
          We keep your information for as long as your account is active, or as needed to provide the Service. If
          you delete your account or specific content, we delete it in turn, except where we need to keep something
          for a legitimate reason (e.g. to comply with the law).
        </p>
      </Section>

      <Section title="7. Your rights and choices">
        <p>
          You can access, update, or delete your saved items and chats directly in Settings — "Reset chats" and
          "Remove items" clear that content, and "Delete account" removes your account entirely. Depending on where
          you live, you may also have the right to request a copy of your information, correct it, restrict or
          object to certain processing, or withdraw consent. Contact us at {CONTACT_EMAIL} for anything Settings
          doesn't cover.
        </p>
      </Section>

      <Section title="8. International transfers">
        <p>
          Your information may be processed in a country other than the one you're in. Where that happens, we take
          reasonable steps to ensure it's protected consistently with this Policy.
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          We use reasonable technical and organisational measures to protect your information. No method of
          transmission or storage is completely secure, so we can't guarantee absolute security.
        </p>
      </Section>

      <Section title="10. Children's privacy">
        <p>
          The Service isn't directed at, and isn't intended for use by, anyone under 16. We don't knowingly collect
          personal information from children under 16.
        </p>
      </Section>

      <Section title="11. Changes to this Policy">
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we'll take reasonable
          steps to let you know (e.g. in the app).
        </p>
      </Section>

      <Section title="12. Contact">
        <p>Questions about this Policy, or a privacy request? Email {CONTACT_EMAIL}.</p>
      </Section>
    </main>
  )
}

export default Privacy
