"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { storefrontService } from "@/lib/services/storefrontService"
import {
  DEFAULT_THEME,
  getStorefrontHeroSurfaceStyle,
  normalizeStorefrontPageVisibility,
  normalizeStorefrontHeroStyle,
  StorefrontHeader,
  StorefrontShell,
} from "@/app/storefront/_components/storefront-ui"

type StorefrontConfig = {
  name: string
  slug: string
  currency: string
  whatsapp_number?: string
  theme_settings?: Record<string, string>
  seo_settings?: {
    contact_title?: string
    contact_description?: string
    contact_cta?: string
    contact_phone?: string
    contact_email?: string
    contact_address?: string
    contact_person?: string
    contact_hero_style?: string
    footer_about?: string
    whatsapp_cta?: string
    facebook_url?: string
    instagram_url?: string
    x_url?: string
    linkedin_url?: string
    youtube_url?: string
    template_key?: string
  }
}

export default function StorefrontContactPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [config, setConfig] = useState<StorefrontConfig | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [subject, setSubject] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [formFeedback, setFormFeedback] = useState("")

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError("")
      try {
        const cfg = await storefrontService.getConfig(slug)
        setConfig(cfg)
      } catch (err: any) {
        setError(err?.message || "Failed to load storefront")
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [slug])

  const theme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...(config?.theme_settings || {}),
    }),
    [config]
  )

  const pageVisibility = useMemo(
    () => normalizeStorefrontPageVisibility(config?.seo_settings as Record<string, any> | undefined),
    [config]
  )

  if (isLoading) {
    return (
      <StorefrontShell theme={DEFAULT_THEME}>
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 text-sm shadow-sm backdrop-blur">
            Loading contact page...
          </div>
        </div>
      </StorefrontShell>
    )
  }

  if (error || !config) {
    return (
      <StorefrontShell theme={DEFAULT_THEME}>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur">
            <h1 className="mb-2 text-2xl font-bold">Storefront unavailable</h1>
            <p>{error || "This storefront could not be loaded."}</p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  if (!pageVisibility.contact) {
    return (
      <StorefrontShell theme={theme}>
        <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="contact" pageVisibility={pageVisibility} />
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur">
            <h1 className="mb-2 text-2xl font-bold">Contact page is currently disabled</h1>
            <p className="text-sm leading-7 opacity-80">This storefront has hidden the contact page. Please use the available navigation links instead.</p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  const contactTitle = config?.seo_settings?.contact_title?.trim() || "Contact us"
  const contactDescription = config?.seo_settings?.contact_description?.trim() || "Reach out to place an order, ask a question, or speak to the team directly."
  const contactCta = config?.seo_settings?.contact_cta?.trim() || "Start a conversation"
  const contactPhone = config?.seo_settings?.contact_phone?.trim() || ""
  const contactEmail = config?.seo_settings?.contact_email?.trim() || ""
  const contactAddress = config?.seo_settings?.contact_address?.trim() || ""
  const contactPerson = config?.seo_settings?.contact_person?.trim() || config?.name || "Store Team"

  const templateKey = config?.seo_settings?.template_key || "nextcommerce_v1"
  const footerAbout = config?.seo_settings?.footer_about?.trim() || config?.seo_settings?.contact_description?.trim() || ""
  const socialLinks = {
    facebook: config?.seo_settings?.facebook_url,
    instagram: config?.seo_settings?.instagram_url,
    x: config?.seo_settings?.x_url,
    linkedin: config?.seo_settings?.linkedin_url,
    youtube: config?.seo_settings?.youtube_url,
  }
  const contactHeroStyle = normalizeStorefrontHeroStyle(config?.seo_settings?.contact_hero_style)
  const isContactHeroLight = contactHeroStyle === "glass"

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormFeedback("")

    if (!firstName.trim() || !lastName.trim() || !message.trim()) {
      setFormFeedback("First name, last name, and message are required.")
      return
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const composedMessage = [
      `New contact request from ${fullName}`,
      subject.trim() ? `Subject: ${subject.trim()}` : "",
      phone.trim() ? `Phone: ${phone.trim()}` : "",
      "",
      message.trim(),
    ]
      .filter(Boolean)
      .join("\n")

    if (config?.whatsapp_number) {
      const digits = config.whatsapp_number.replace(/\D/g, "")
      const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(composedMessage)}`
      window.open(waUrl, "_blank", "noopener,noreferrer")
      setFormFeedback("Message prepared for WhatsApp. Complete sending in WhatsApp.")
      return
    }

    if (contactEmail) {
      const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(subject.trim() || `Message from ${fullName}`)}&body=${encodeURIComponent(composedMessage)}`
      window.location.href = mailto
      setFormFeedback("Opened your mail app with the message.")
      return
    }

    setFormFeedback("No contact channel is configured yet. Please use the phone details shown.")
  }

  return (
    <StorefrontShell theme={theme} templateKey={templateKey} storeName={config.name} footerSlug={slug} footerAbout={footerAbout} socialLinks={socialLinks}>
      <StorefrontHeader slug={slug} storeName={config.name} theme={theme} active="contact" pageVisibility={pageVisibility} />

      <section className="mx-auto w-full max-w-[1170px] px-4 pb-8 pt-8 sm:px-8 xl:px-0">
        <div
          className="overflow-hidden rounded-[10px] p-7.5 shadow-1 sm:p-10"
          style={getStorefrontHeroSurfaceStyle(theme, contactHeroStyle)}
        >
          <p className={`text-custom-xs font-semibold uppercase tracking-[0.16em] ${isContactHeroLight ? "text-dark/70" : "text-white/80"}`}>Contact</p>
          <h1 className={`mt-3 max-w-3xl text-custom-2xl font-semibold sm:text-custom-4xl ${isContactHeroLight ? "text-dark" : "text-white"}`}>{contactTitle}</h1>
          <p className={`mt-4 max-w-[760px] text-custom-sm ${isContactHeroLight ? "text-body" : "text-white/90"}`}>{contactDescription}</p>
        </div>
      </section>

      <section className="overflow-hidden bg-gray-2 py-20">
        <div className="mx-auto w-full max-w-[1170px] px-4 sm:px-8 xl:px-0">
          <div className="flex flex-col gap-7.5 xl:flex-row">
            <div className="w-full rounded-xl bg-white shadow-1 xl:max-w-[370px]">
              <div className="border-b border-gray-3 px-4 py-5 sm:px-7.5">
                <p className="text-xl font-medium text-dark">Contact Information</p>
              </div>

              <div className="p-4 sm:p-7.5">
                <div className="flex flex-col gap-4 text-custom-sm text-dark">
                  <p className="flex items-center gap-4">
                    <span className="font-semibold">Name:</span> {contactPerson}
                  </p>
                  {contactPhone ? (
                    <p className="flex items-center gap-4">
                      <span className="font-semibold">Phone:</span> {contactPhone}
                    </p>
                  ) : null}
                  {contactEmail ? (
                    <p className="flex items-center gap-4">
                      <span className="font-semibold">Email:</span> {contactEmail}
                    </p>
                  ) : null}
                  {contactAddress ? (
                    <p className="flex gap-4">
                      <span className="font-semibold">Address:</span>
                      <span>{contactAddress}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="w-full rounded-xl bg-white p-4 shadow-1 sm:p-7.5 xl:max-w-[770px] xl:p-10">
              <p className="mb-5 text-custom-lg font-semibold text-dark">{contactCta}</p>
              <form onSubmit={handleSubmit}>
                <div className="mb-5 flex flex-col gap-5 sm:gap-8 lg:flex-row">
                  <div className="w-full">
                    <label htmlFor="firstName" className="mb-2.5 block">
                      First Name <span className="text-red">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full rounded-md border border-gray-3 bg-gray-1 px-5 py-2.5 placeholder:text-dark-5 outline-none duration-200 focus:border-transparent focus:ring-2 focus:ring-blue/20"
                    />
                  </div>

                  <div className="w-full">
                    <label htmlFor="lastName" className="mb-2.5 block">
                      Last Name <span className="text-red">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full rounded-md border border-gray-3 bg-gray-1 px-5 py-2.5 placeholder:text-dark-5 outline-none duration-200 focus:border-transparent focus:ring-2 focus:ring-blue/20"
                    />
                  </div>
                </div>

                <div className="mb-5 flex flex-col gap-5 sm:gap-8 lg:flex-row">
                  <div className="w-full">
                    <label htmlFor="subject" className="mb-2.5 block">Subject</label>
                    <input
                      type="text"
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Type your subject"
                      className="w-full rounded-md border border-gray-3 bg-gray-1 px-5 py-2.5 placeholder:text-dark-5 outline-none duration-200 focus:border-transparent focus:ring-2 focus:ring-blue/20"
                    />
                  </div>

                  <div className="w-full">
                    <label htmlFor="phone" className="mb-2.5 block">Phone</label>
                    <input
                      type="text"
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter your phone"
                      className="w-full rounded-md border border-gray-3 bg-gray-1 px-5 py-2.5 placeholder:text-dark-5 outline-none duration-200 focus:border-transparent focus:ring-2 focus:ring-blue/20"
                    />
                  </div>
                </div>

                <div className="mb-7.5">
                  <label htmlFor="message" className="mb-2.5 block">
                    Message <span className="text-red">*</span>
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message"
                    className="w-full rounded-md border border-gray-3 bg-gray-1 p-5 placeholder:text-dark-5 outline-none duration-200 focus:border-transparent focus:ring-2 focus:ring-blue/20"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex rounded-md bg-blue px-7 py-3 font-medium text-white duration-200 hover:bg-blue-dark"
                  >
                    Send Message
                  </button>
                  <Link href={`/storefront/${slug}/shop`} className="rounded-md border border-gray-3 px-6 py-3 text-custom-sm font-semibold text-dark transition hover:border-blue hover:text-blue">
                    Browse products
                  </Link>
                </div>

                {formFeedback ? <p className="mt-4 text-custom-sm text-body">{formFeedback}</p> : null}
              </form>
            </div>
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
