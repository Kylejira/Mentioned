import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { FormInput } from "@/components/ui/form-input"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatusIcon } from "@/components/ui/status-icon"
import { ArrowRight, Plus, Settings, Sparkles } from "lucide-react"

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <h1 className="text-display text-foreground">Mentioned</h1>
          </div>
          <p className="text-body-lg">
            Design System & Component Library
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 space-y-24">
        {/* Color Palette */}
        <section>
          <SectionHeader
            title="Color Palette"
            description="A premium light palette with warm undertones for easy readability"
          />
          
          <div className="space-y-10">
            {/* Core Colors */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Core Colors</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ColorSwatch name="Background" className="bg-background border border-border" />
                <ColorSwatch name="Foreground" className="bg-foreground" textLight />
                <ColorSwatch name="Card" className="bg-card border border-border" />
                <ColorSwatch name="Muted" className="bg-muted" />
              </div>
            </div>

            {/* Brand Colors */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Brand Colors</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ColorSwatch name="Primary" className="bg-primary" textLight />
                <ColorSwatch name="Secondary" className="bg-secondary" />
                <ColorSwatch name="Accent" className="bg-accent" />
                <ColorSwatch name="Border" className="bg-border" />
              </div>
            </div>

            {/* Status Colors */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Status Colors</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-3">
                  <ColorSwatch name="Success" className="bg-status-success" textLight />
                  <ColorSwatch name="Success Muted" className="bg-status-success-muted" />
                </div>
                <div className="space-y-3">
                  <ColorSwatch name="Warning" className="bg-status-warning" textLight />
                  <ColorSwatch name="Warning Muted" className="bg-status-warning-muted" />
                </div>
                <div className="space-y-3">
                  <ColorSwatch name="Error" className="bg-status-error" textLight />
                  <ColorSwatch name="Error Muted" className="bg-status-error-muted" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section>
          <SectionHeader
            title="Typography"
            description="Clean hierarchy with generous spacing using Geist font family"
          />
          
          <div className="space-y-8">
            <div className="space-y-8">
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">.text-display — 5xl, semibold, tight tracking</p>
                <p className="text-display text-foreground">Display Heading</p>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">h1 — 4xl, semibold, tight tracking</p>
                <h1>Heading One</h1>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">.text-title — 3xl, semibold, tight tracking</p>
                <p className="text-title text-foreground">Title Text</p>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">h2 — 2xl, semibold, tight tracking</p>
                <h2>Heading Two</h2>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">h3 — xl, medium</p>
                <h3>Heading Three</h3>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">h4 — lg, medium</p>
                <h4>Heading Four</h4>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">.text-body-lg — lg, muted foreground, relaxed leading</p>
                <p className="text-body-lg">Large body text for introductions and important paragraphs that need emphasis.</p>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">.text-body — base, muted foreground, relaxed leading</p>
                <p className="text-body">Regular body text for general content. This is optimized for readability with comfortable line height.</p>
              </div>
              
              <div className="border-b border-border pb-6">
                <p className="text-caption mb-3">.text-body-sm — sm, muted foreground</p>
                <p className="text-body-sm">Small body text for secondary information and helper text.</p>
              </div>
              
              <div>
                <p className="text-caption mb-3">.text-caption — xs, muted foreground</p>
                <p className="text-caption">Caption text for metadata and fine print.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section>
          <SectionHeader
            title="Spacing System"
            description="Consistent spacing for a premium, breathable layout"
          />
          
          <div className="space-y-6">
            <div className="flex items-end gap-4 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((size) => (
                <div key={size} className="flex flex-col items-center gap-2">
                  <div
                    className="bg-primary rounded-lg"
                    style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
                  />
                  <span className="text-caption">{size}</span>
                </div>
              ))}
            </div>
            <p className="text-body-sm">
              Spacing scale follows Tailwind defaults (1 unit = 4px). Key values: 4 (16px), 6 (24px), 8 (32px), 12 (48px), 16 (64px).
            </p>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <SectionHeader
            title="Buttons"
            description="Pill-shaped buttons with primary, secondary, and ghost variants"
          />
          
          <div className="space-y-10">
            {/* Variants */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Variants</h4>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="default">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
            </div>

            {/* Icon Buttons */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Icon Buttons</h4>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="icon"><Plus /></Button>
                <Button size="icon-sm" variant="secondary"><Settings className="size-4" /></Button>
                <Button size="icon" variant="ghost"><Sparkles /></Button>
              </div>
            </div>

            {/* With Icons */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">With Icons</h4>
              <div className="flex flex-wrap items-center gap-4">
                <Button>
                  Get Started
                  <ArrowRight />
                </Button>
                <Button variant="secondary">
                  <Plus />
                  Add Item
                </Button>
                <Button variant="ghost">
                  <Settings />
                  Settings
                </Button>
              </div>
            </div>

            {/* States */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">States</h4>
              <div className="flex flex-wrap items-center gap-4">
                <Button>Normal</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Inputs */}
        <section>
          <SectionHeader
            title="Form Inputs"
            description="Input fields with labels, helper text, and error states"
          />
          
          <div className="max-w-md space-y-8">
            <FormInput
              label="Brand Name"
              placeholder="e.g., Notion"
              helperText="Enter your company or product name"
            />
            
            <FormInput
              label="Website URL"
              placeholder="e.g., notion.so"
              type="url"
            />
            
            <FormInput
              label="Description"
              placeholder="e.g., Project management for remote teams"
              helperText="Describe it how a customer would"
            />
            
            <FormInput
              label="Email Address"
              placeholder="you@example.com"
              type="email"
              error="Please enter a valid email address"
              defaultValue="invalid-email"
            />
            
            <FormInput
              label="Disabled Input"
              placeholder="Cannot edit"
              disabled
              defaultValue="Read-only value"
            />
          </div>
        </section>

        {/* Cards */}
        <section>
          <SectionHeader
            title="Cards"
            description="Container component for grouping related content"
          />
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>
                  A brief description of what this card contains.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-body-sm">
                  Card content goes here. Cards provide a clean container for grouping related information with consistent spacing.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm">Learn More</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Another Card</CardTitle>
                <CardDescription>
                  Cards can contain any type of content.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <StatusIcon status="success" withBackground />
                  <span className="text-body-sm text-foreground">Feature enabled</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusIcon status="warning" withBackground />
                  <span className="text-body-sm text-foreground">Needs attention</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusIcon status="error" withBackground />
                  <span className="text-body-sm text-foreground">Action required</span>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  Cards can also be used as simple containers without headers or footers.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Status Badges */}
        <section>
          <SectionHeader
            title="Status Badges"
            description="Large status indicators showing visibility states"
          />
          
          <div className="space-y-10">
            {/* All States */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Visibility States</h4>
              <div className="flex flex-wrap items-center gap-4">
                <StatusBadge status="recommended" />
                <StatusBadge status="low-visibility" />
                <StatusBadge status="not-mentioned" />
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
              <div className="flex flex-wrap items-center gap-4">
                <StatusBadge status="recommended" size="default" />
                <StatusBadge status="recommended" size="lg" />
              </div>
            </div>

            {/* Custom Labels */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Custom Labels</h4>
              <div className="flex flex-wrap items-center gap-4">
                <StatusBadge status="recommended" customLabel="Top 3 Result" />
                <StatusBadge status="low-visibility" customLabel="Mentioned Once" />
                <StatusBadge status="not-mentioned" customLabel="Not Found" />
              </div>
            </div>

            {/* In Context */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">In Context</h4>
              <Card>
                <CardContent className="py-10">
                  <div className="flex flex-col items-center text-center gap-4">
                    <StatusBadge status="recommended" size="lg" />
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Your Visibility Status</h3>
                      <p className="text-muted-foreground mt-1">
                        AI tools actively recommend your product
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Status Icons */}
        <section>
          <SectionHeader
            title="Status Icons"
            description="Small inline status indicators for lists and tables"
          />
          
          <div className="space-y-10">
            {/* Basic */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Basic</h4>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <StatusIcon status="success" />
                  <span className="text-body-sm text-foreground">Success</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="warning" />
                  <span className="text-body-sm text-foreground">Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="error" />
                  <span className="text-body-sm text-foreground">Error</span>
                </div>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Sizes</h4>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <StatusIcon status="success" size="sm" />
                  <span className="text-body-sm text-foreground">Small</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="success" size="default" />
                  <span className="text-body-sm text-foreground">Default</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon status="success" size="lg" />
                  <span className="text-body-sm text-foreground">Large</span>
                </div>
              </div>
            </div>

            {/* With Background */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">With Background</h4>
              <div className="flex items-center gap-6">
                <StatusIcon status="success" withBackground />
                <StatusIcon status="warning" withBackground />
                <StatusIcon status="error" withBackground />
              </div>
              <div className="flex items-center gap-6 mt-4">
                <StatusIcon status="success" withBackground size="sm" />
                <StatusIcon status="success" withBackground size="default" />
                <StatusIcon status="success" withBackground size="lg" />
              </div>
            </div>

            {/* In Context - Signal List */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">In Context — Signal List</h4>
              <Card>
                <CardHeader>
                  <CardTitle>Visibility Signals</CardTitle>
                  <CardDescription>What&apos;s helping or hurting your visibility</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <StatusIcon status="success" withBackground className="mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-foreground">Category Association</p>
                        <p className="text-body-sm">AI connects your product to this category</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <StatusIcon status="warning" withBackground className="mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-foreground">Comparison Content</p>
                        <p className="text-body-sm">Limited comparison content on your site</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <StatusIcon status="error" withBackground className="mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-foreground">Question Coverage</p>
                        <p className="text-body-sm">Your site doesn&apos;t answer common questions</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Combined Example */}
        <section>
          <SectionHeader
            title="Combined Example"
            description="Components working together to create a cohesive interface"
          />
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>ChatGPT Results</CardTitle>
                  <CardDescription>How ChatGPT responds to category queries</CardDescription>
                </div>
                <StatusBadge status="low-visibility" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between py-4 border-b border-border">
                <span className="text-body-sm text-foreground">&quot;Best project management tools&quot;</span>
                <StatusIcon status="warning" />
              </div>
              <div className="flex items-center justify-between py-4 border-b border-border">
                <span className="text-body-sm text-foreground">&quot;Notion alternatives&quot;</span>
                <StatusIcon status="success" />
              </div>
              <div className="flex items-center justify-between py-4">
                <span className="text-body-sm text-foreground">&quot;What is Notion?&quot;</span>
                <StatusIcon status="error" />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <p className="text-caption">Last checked: 2 hours ago</p>
              <Button variant="ghost" size="sm">
                View Details
                <ArrowRight />
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-24 bg-card">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-caption text-center">
            Mentioned Design System — Built with Next.js, Tailwind CSS, and shadcn/ui
          </p>
        </div>
      </footer>
    </div>
  )
}

// Helper Components

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-muted-foreground mt-1">{description}</p>
    </div>
  )
}

function ColorSwatch({
  name,
  className,
  textLight = false,
}: {
  name: string
  className: string
  textLight?: boolean
}) {
  return (
    <div className={`rounded-xl p-4 h-24 flex items-end ${className}`}>
      <span className={`text-xs font-medium ${textLight ? "text-white" : "text-foreground"}`}>
        {name}
      </span>
    </div>
  )
}
