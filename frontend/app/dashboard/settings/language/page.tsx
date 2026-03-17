"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/contexts/i18n-context"
import { LOCALES, Locale } from "@/lib/i18n"
import { useTenant } from "@/contexts/tenant-context"
import { useToast } from "@/components/ui/use-toast"
import { Check, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LanguageSettingsPage() {
  const { locale, setLocale, t, isLoading: i18nLoading } = useI18n()
  const { currentTenant } = useTenant()
  const { toast } = useToast()
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale)
  const [isSaving, setIsSaving] = useState(false)

  // Sync with current locale
  useEffect(() => {
    setSelectedLocale(locale)
  }, [locale])

  const handleSave = async () => {
    if (selectedLocale === locale) {
      toast({
        title: t("settings.messages.saved"),
        description: t("settings.language.current") + ": " + LOCALES.find(l => l.code === selectedLocale)?.nativeName,
      })
      return
    }

    setIsSaving(true)
    try {
      await setLocale(selectedLocale)
      toast({
        title: locale === "en" ? "Language Changed" : "Chilankhulo Chasinthidwa",
        description: selectedLocale === "en" 
          ? "Language changed to English" 
          : "Chilankhulo chasinthidwa kukhala Chichewa",
      })
    } catch (error) {
      toast({
        title: t("common.messages.error"),
        description: t("settings.messages.save_failed"),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("settings.language.title")}
        description={t("settings.language.select")}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t("settings.language.select")}
            </CardTitle>
            <CardDescription>
              {locale === "en" 
                ? "Select your preferred language. This will be saved to your business settings."
                : "Sankhani chilankhulo chomwe mukuchifuna. Ichi chidzasungidwa ku zokonzekera za bizinesi yanu."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LOCALES.map((lang) => (
                <div
                  key={lang.code}
                  className={cn(
                    "relative p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md",
                    selectedLocale === lang.code
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedLocale(lang.code)}
                >
                  {selectedLocale === lang.code && (
                    <div className="absolute top-3 right-3">
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center">
                    {/* Flag SVG */}
                    <div className="mb-4 rounded-lg overflow-hidden shadow-sm border">
                      {lang.code === "en" ? (
                        <svg className="h-16 w-24" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#012169" d="M0 0h640v480H0z"/>
                          <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
                          <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
                          <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
                          <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
                        </svg>
                      ) : (
                        <svg className="h-16 w-24" viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#000" d="M0 0h640v160H0z"/>
                          <path fill="#f41408" d="M0 160h640v160H0z"/>
                          <path fill="#21873b" d="M0 320h640v160H0z"/>
                          <g fill="#f41408" transform="translate(320 80)">
                            <circle r="50"/>
                            <path d="M0-80v60M-30-70l30 50 30-50M-50-50l50 40 50-40M-60-25l60 25 60-25" stroke="#f41408" strokeWidth="8"/>
                          </g>
                        </svg>
                      )}
                    </div>
                    <div className="text-xl font-semibold mb-1">
                      {lang.nativeName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lang.name}
                    </div>
                    {lang.code === locale && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        {t("settings.language.current")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Preview Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="text-sm font-medium mb-2">
                {locale === "en" ? "Preview" : "Onani Kaye"}:
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {selectedLocale === "en" ? "Dashboard" : "Gawo Lalikulu"}:
                  </span>
                  <span>
                    {selectedLocale === "en" ? "Your business overview" : "Kufotokoza kwa bizinesi yanu"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {selectedLocale === "en" ? "New Sale" : "Kugulitsa Kwatsopano"}:
                  </span>
                  <span>
                    {selectedLocale === "en" ? "Start a new transaction" : "Yambani malonda atsopano"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {selectedLocale === "en" ? "Total" : "Zonse"}:
                  </span>
                  <span>MWK 0.00</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                {locale === "en" ? (
                  <>
                    <strong>Note:</strong> Language changes will apply immediately across the entire system.
                    Product names, currency amounts, and barcodes will remain unchanged.
                  </>
                ) : (
                  <>
                    <strong>Dziwani:</strong> Kusintha kwa chilankhulo kudzagwira ntchito mwachangu pa makina onse.
                    Mayina a zinthu, ndalama, ndi ma barcode sizidzasinthidwa.
                  </>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => setSelectedLocale(locale)}
                disabled={selectedLocale === locale || isSaving}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || i18nLoading}
              >
                {isSaving ? t("common.actions.saving") : t("common.actions.save")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {locale === "en" ? "About Languages" : "Za Zilankhulo"}
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none text-sm">
            {locale === "en" ? (
              <div className="space-y-3">
                <p>
                  <strong>English:</strong> Default language with full support for all features.
                </p>
                <p>
                  <strong>Chichewa:</strong> Malawi&apos;s national language, optimized for local business users.
                  Translations use clear, business-friendly language suitable for cashiers and managers.
                </p>
                <p>
                  All translations maintain consistency with POS terminology to ensure cashiers can work efficiently.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p>
                  <strong>Chingelezi:</strong> Chilankhulo choyambirira chomwe chimagwira ntchito pa zonse.
                </p>
                <p>
                  <strong>Chichewa:</strong> Chilankhulo cha dziko la Malawi, chopangidwa bwino kwa anthu ogwira ntchito ya bizinesi.
                  Zomasulira zimagwiritsa mawu omveka bwino oyenera anthu ogulitsa ndi akuluakulu.
                </p>
                <p>
                  Zomasulira zonse zimasunga ubale ndi mawu a makina ogulitsira kuti anthu ogulitsa agwire ntchito bwino.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </DashboardLayout>
  )
}

