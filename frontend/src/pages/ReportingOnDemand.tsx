import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, FileText, Download, CheckCircle2, TrendingUp, Clock, PenTool } from 'lucide-react';
import SectionTabBar from '@/components/dashboard/SectionTabBar';

const reportingTabs = [
  { id: 'executive', label: 'Executive Reports', icon: TrendingUp, route: '/dashboard/reporting/executive' },
  { id: 'scheduled', label: 'Scheduled Reports', icon: Clock, route: '/dashboard/reporting/scheduled' },
  { id: 'on-demand', label: 'On-Demand Builder', icon: PenTool, route: '/dashboard/reporting/on-demand' },
];

const steps = ['Select Template', 'Choose Scope', 'Configure Options', 'Generate'];

const templates = [
  { id: 'custom', name: 'Custom Report', description: 'Build a report with selected sections' },
  { id: 'executive', name: 'Executive Summary', description: 'High-level overview for leadership' },
  { id: 'technical', name: 'Technical Deep-Dive', description: 'Detailed crypto analysis per asset' },
  { id: 'audit', name: 'Audit Trail', description: 'Full scan history and changes' },
];

const sections = [
  { id: 'qscore', label: 'Q-Score Overview', category: 'Summary' },
  { id: 'tier', label: 'Tier Classification', category: 'Summary' },
  { id: 'assets', label: 'Asset Inventory', category: 'Discovery' },
  { id: 'cbom', label: 'CBOM Details', category: 'Analysis' },
  { id: 'hndl', label: 'HNDL Risk Analysis', category: 'Analysis' },
  { id: 'quantum-debt', label: 'Quantum Debt Score', category: 'Analysis' },
  { id: 'remediation', label: 'Remediation Plan', category: 'Actions' },
  { id: 'roadmap', label: 'Migration Roadmap', category: 'Actions' },
  { id: 'compliance', label: 'NIST Compliance Matrix', category: 'Compliance' },
  { id: 'patches', label: 'Recommended Patches', category: 'Actions' },
];

const ReportingOnDemand = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState('pdf');
  const [generated, setGenerated] = useState(false);

  const toggleSection = (id: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canProceed = () => {
    if (currentStep === 0) return !!selectedTemplate;
    if (currentStep === 1) return selectedSections.size > 0;
    return true;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">On-Demand Report Builder</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Create custom reports by selecting templates, sections, and output format</p>
      </div>
      <SectionTabBar tabs={reportingTabs} />

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              i === currentStep ? 'bg-brand-primary text-accent-amber font-bold' :
              i < currentStep ? 'bg-status-safe/10 text-status-safe' :
              'bg-sunken text-muted-foreground'
            }`}>
              {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{step}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="bg-surface border-border min-h-[350px]">
        <CardContent className="pt-6">
          {currentStep === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedTemplate === t.id
                      ? 'border-accent-amber bg-accent-amber/5 shadow-sm'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <p className="font-body text-sm font-medium text-foreground">{t.name}</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">{t.description}</p>
                </button>
              ))}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="font-body text-sm text-muted-foreground">Select the sections to include in your report:</p>
              {['Summary', 'Discovery', 'Analysis', 'Actions', 'Compliance'].map((category) => (
                <div key={category}>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{category}</p>
                  <div className="space-y-2">
                    {sections.filter(s => s.category === category).map((section) => (
                      <label key={section.id} className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={selectedSections.has(section.id)}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                        <span className="font-body text-sm text-foreground">{section.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground mb-1.5 block">Output Format</label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Report</SelectItem>
                    <SelectItem value="html">HTML Report</SelectItem>
                    <SelectItem value="csv">CSV Data Export</SelectItem>
                    <SelectItem value="json">JSON (CycloneDX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-muted-foreground mb-1.5">Report Summary</p>
                <div className="bg-sunken rounded-lg p-3 space-y-1">
                  <p className="font-body text-xs"><span className="text-muted-foreground">Template:</span> {templates.find(t => t.id === selectedTemplate)?.name}</p>
                  <p className="font-body text-xs"><span className="text-muted-foreground">Sections:</span> {selectedSections.size} selected</p>
                  <p className="font-body text-xs"><span className="text-muted-foreground">Format:</span> {format.toUpperCase()}</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {!generated ? (
                <>
                  <FileText className="w-12 h-12 text-accent-amber mb-4" />
                  <p className="font-body text-lg font-semibold text-foreground mb-2">Ready to Generate</p>
                  <p className="font-body text-sm text-muted-foreground mb-6 max-w-sm">
                    Your report will include {selectedSections.size} sections in {format.toUpperCase()} format
                  </p>
                  <Button
                    className="gap-2 bg-accent-amber text-brand-primary hover:brightness-105"
                    onClick={() => setGenerated(true)}
                  >
                    <Download className="w-4 h-4" /> Generate Report
                  </Button>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-12 h-12 text-status-safe mb-4" />
                  <p className="font-body text-lg font-semibold text-foreground mb-2">Report Generated!</p>
                  <p className="font-body text-sm text-muted-foreground mb-6">Your report has been generated successfully</p>
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" /> Download Report
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => prev - 1)}
          disabled={currentStep === 0}
          className="gap-1.5 text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </Button>
        {currentStep < 3 && (
          <Button
            onClick={() => setCurrentStep(prev => prev + 1)}
            disabled={!canProceed()}
            className="gap-1.5 text-xs bg-accent-amber text-brand-primary hover:brightness-105"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReportingOnDemand;
