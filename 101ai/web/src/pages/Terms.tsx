import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

function Terms() {
  const navigate = useNavigate()

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-900">Terms of Service</h1>
      <p className="mt-1 text-xs text-slate-400">Last updated: {LAST_UPDATED}</p>

      <Section title="1. Agreement to these terms">
        <p>
          These Terms of Service ("Terms") are an agreement between you and {OPERATOR_NAME} ("we", "us", "our"),
          governing your use of the 101 AI Tools application and website (the "Service"). By creating an account or
          otherwise using the Service, you agree to these Terms. If you don't agree, please don't use the Service.
        </p>
      </Section>

      <Section title="2. Who can use the Service">
        <p>
          You must be at least 16 years old to use the Service. By using the Service you confirm that you meet this
          requirement and that any information you provide when registering is accurate.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          You're responsible for keeping your account credentials secure and for all activity that happens under
          your account. Let us know right away at {CONTACT_EMAIL} if you believe your account has been accessed
          without your permission.
        </p>
        <p>
          You can delete your account at any time from Settings, or by contacting us. Deleting your account removes
          your account and the content associated with it, as described in our{' '}
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="4. AI-generated content">
        <p>
          The Service uses third-party AI models to generate responses, suggestions, plans, and other content based
          on what you enter. AI-generated content can be incomplete, out of date, or simply wrong. Nothing produced
          by the Service is professional advice (medical, legal, financial, or otherwise), and you shouldn't rely on
          it as a substitute for consulting a qualified professional where it matters.
        </p>
        <p>You're responsible for how you use any content the Service generates.</p>
      </Section>

      <Section title="5. Your content">
        <p>
          You keep ownership of whatever you type, upload, or otherwise submit to the Service ("your content"). By
          submitting content, you give us the permission needed to store it, process it (including sending it to the
          third-party service providers described in our Privacy Policy), and display it back to you so the Service
          can actually work.
        </p>
        <p>
          Don't submit anything you don't have the right to share, or anything unlawful, infringing, or harmful to
          others.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Use the Service for anything illegal, or to harass, abuse, or harm another person</li>
          <li>Attempt to disrupt, overload, or gain unauthorised access to the Service or its infrastructure</li>
          <li>Use the Service to generate content that's illegal, infringing, or intended to deceive or defraud</li>
          <li>Reverse-engineer, scrape, or resell the Service without our permission</li>
        </ul>
        <p>We can suspend or terminate accounts that violate these Terms.</p>
      </Section>

      <Section title="7. Subscriptions and payment">
        <p>
          The Service offers a Free plan and paid Plus/Premium plans with additional features. Paid plans aren't
          available for purchase yet. Once they are, we'll set out pricing, billing frequency, and cancellation terms
          clearly before you subscribe, and this section will be updated to reflect them.
        </p>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          The Service itself — its design, code, and branding — belongs to us or our licensors. These Terms don't
          grant you any rights to it beyond what's needed to use the Service as intended.
        </p>
      </Section>

      <Section title="9. Disclaimers and limitation of liability">
        <p>
          The Service is provided "as is", without warranties of any kind, express or implied. We don't guarantee the
          Service will be uninterrupted, error-free, or that AI-generated content will be accurate or fit for any
          particular purpose.
        </p>
        <p>
          To the fullest extent permitted by law, we aren't liable for any indirect, incidental, or consequential
          damages arising from your use of the Service, or for decisions made based on AI-generated content.
        </p>
      </Section>

      <Section title="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we'll take reasonable steps to
          let you know (e.g. in the app). Continuing to use the Service after changes take effect means you accept
          the updated Terms.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>These Terms are governed by the laws of England and Wales.</p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions about these Terms? Email {CONTACT_EMAIL}.
        </p>
      </Section>
    </main>
  )
}

export default Terms
