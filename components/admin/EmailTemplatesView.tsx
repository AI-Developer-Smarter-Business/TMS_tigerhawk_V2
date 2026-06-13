"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Mail,
  Loader2,
  RefreshCw,
  Pencil,
  X,
  Save,
  Plus,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Code,
  Tag,
  Send,
} from "lucide-react"

const S = {
  panel: "bg-[#141922] border-[#1e2530]",
  panelHeader: "bg-[#0B1120] border-[#1e2530]",
  input:
    "bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none",
  th: "px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]",
  td: "px-4 py-3 text-[11px] text-gray-300 border-b border-[#1e2530]/60",
}

type EmailTemplate = {
  id: string
  template_key: string
  name: string
  subject: string
  body_html: string
  variables: string[]
  is_active: boolean
  updated_at: string
}

export function EmailTemplatesView() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-templates")
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      } else {
        const data = await res.json()
        setError(data.error || "Failed to fetch templates")
      }
    } catch (err) {
      console.error("Error fetching email templates:", err)
      setError("Network error")
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchTemplates()
      setLoading(false)
    }
    load()
  }, [fetchTemplates])

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id, is_active: !template.is_active }),
      })
      if (res.ok) {
        fetchTemplates()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to toggle template")
      }
    } catch {
      alert("Network error")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail size={20} className="text-[#E8700A]" />
            Email Templates
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage email templates for notifications, invitations, and alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTemplates}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-[#1a2236] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Plus size={13} /> New Template
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Info box */}
      <div className="px-4 py-3 bg-blue-500/5 border border-blue-500/15 rounded-lg">
        <p className="text-xs text-blue-300">
          <strong>Note:</strong> Supabase Auth emails (magic link, password reset) are configured in
          the Supabase dashboard. These templates are for custom notifications sent by the TMS
          (settlement alerts, status updates, overdue reminders, etc.).
        </p>
      </div>

      {/* Templates table */}
      <div className={`rounded-xl border overflow-hidden ${S.panel}`}>
        {templates.length === 0 ? (
          <div className="py-12 text-center">
            <Mail size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No email templates found. Run the migration to seed defaults.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={S.th}>Status</th>
                  <th className={S.th}>Name</th>
                  <th className={S.th}>Key</th>
                  <th className={S.th}>Subject</th>
                  <th className={S.th}>Variables</th>
                  <th className={S.th}>Updated</th>
                  <th className={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-[#1a2030]/50 transition-colors">
                    <td className={S.td}>
                      <button onClick={() => handleToggleActive(t)}>
                        {t.is_active ? (
                          <ToggleRight size={20} className="text-[#E8700A]" />
                        ) : (
                          <ToggleLeft size={20} className="text-gray-600" />
                        )}
                      </button>
                    </td>
                    <td className={S.td}>
                      <span className="text-white font-medium">{t.name}</span>
                    </td>
                    <td className={S.td}>
                      <code className="text-[10px] text-gray-500 bg-[#0B1120] px-1.5 py-0.5 rounded font-mono">
                        {t.template_key}
                      </code>
                    </td>
                    <td className={S.td}>
                      <span className="text-gray-300 max-w-[200px] truncate block">
                        {t.subject}
                      </span>
                    </td>
                    <td className={S.td}>
                      <div className="flex flex-wrap gap-1">
                        {t.variables.slice(0, 3).map((v) => (
                          <span
                            key={v}
                            className="text-[9px] px-1.5 py-0.5 bg-[#E8700A]/10 text-[#E8700A] rounded border border-[#E8700A]/20"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                        {t.variables.length > 3 && (
                          <span className="text-[9px] text-gray-500">
                            +{t.variables.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={S.td}>
                      {new Date(t.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className={S.td}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingTemplate(t)}
                          className="p-1.5 hover:bg-blue-500/20 rounded text-gray-500 hover:text-blue-400 transition-colors"
                          title="Edit template"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setTestingTemplate(t)}
                          className="p-1.5 hover:bg-green-500/20 rounded text-gray-500 hover:text-green-400 transition-colors"
                          title="Send test email"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            setEditingTemplate(null)
            fetchTemplates()
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchTemplates()
          }}
        />
      )}

      {/* Send Test Modal */}
      {testingTemplate && (
        <SendTestModal
          template={testingTemplate}
          onClose={() => setTestingTemplate(null)}
        />
      )}
    </div>
  )
}

// ─── Edit Template Modal ────────────────────────────────────
function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [bodyHtml, setBodyHtml] = useState(template.body_html)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  const handleSave = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      setError("Subject and body are required")
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: template.id,
          name: name.trim(),
          subject: subject.trim(),
          body_html: bodyHtml.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save")
        return
      }
      onSaved()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  // Preview: replace variables with placeholder values
  const previewHtml = bodyHtml.replace(
    /\{\{(\w+)\}\}/g,
    (_, varName) => `<span style="background:#E8700A;color:white;padding:1px 4px;border-radius:3px;font-size:11px;">${varName}</span>`
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530] mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#E8700A]" />
            Edit Template
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Template key (read-only) */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Code size={12} />
            Key: <code className="bg-[#0B1120] px-2 py-0.5 rounded font-mono text-gray-400">{template.template_key}</code>
          </div>

          {/* Available variables */}
          {template.variables.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={12} className="text-gray-500" />
              <span className="text-[10px] text-gray-500">Variables:</span>
              {template.variables.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    // Insert variable at cursor in body
                    setBodyHtml((prev) => prev + `{{${v}}}`)
                  }}
                  className="text-[10px] px-1.5 py-0.5 bg-[#E8700A]/10 text-[#E8700A] rounded border border-[#E8700A]/20 hover:bg-[#E8700A]/20 transition-colors cursor-pointer"
                  title={`Click to insert {{${v}}}`}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-400">Body (HTML)</label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                {showPreview ? "Edit" : "Preview"}
              </button>
            </div>

            {showPreview ? (
              <div
                className="w-full px-4 py-3 rounded-lg bg-white text-black text-sm min-h-[200px] max-h-[400px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={10}
                className={`w-full px-3 py-2 rounded-lg text-xs font-mono ${S.input} resize-y`}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            <Save size={14} />
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create Template Modal ──────────────────────────────────
function CreateTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [templateKey, setTemplateKey] = useState("")
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [variablesStr, setVariablesStr] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleCreate = async () => {
    if (!templateKey.trim() || !name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setError("All fields are required")
      return
    }

    if (!/^[a-z][a-z0-9_]*$/.test(templateKey.trim())) {
      setError("Key must be lowercase with underscores (e.g. my_template)")
      return
    }

    const variables = variablesStr
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: templateKey.trim(),
          name: name.trim(),
          subject: subject.trim(),
          body_html: bodyHtml.trim(),
          variables,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create template")
        return
      }
      onCreated()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530] mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus size={18} className="text-[#E8700A]" />
            New Email Template
          </h2>

          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Template Key *</label>
            <input
              type="text"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              className={`w-full px-3 py-2 rounded-lg text-sm font-mono ${S.input}`}
              placeholder="my_custom_template"
            />
            <p className="text-[10px] text-gray-600 mt-0.5">
              Lowercase with underscores. Used to reference the template in code.
            </p>
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
              placeholder="My Custom Notification"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
              placeholder="Your {{item}} is ready"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">
              Variables (comma-separated)
            </label>
            <input
              type="text"
              value={variablesStr}
              onChange={(e) => setVariablesStr(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
              placeholder="customer_name, load_number, amount"
            />
            <p className="text-[10px] text-gray-600 mt-0.5">
              Use {"{{variable_name}}"} in subject and body to insert dynamic values.
            </p>
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Body (HTML) *</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={6}
              className={`w-full px-3 py-2 rounded-lg text-xs font-mono ${S.input} resize-y`}
              placeholder="<h2>Hello {{customer_name}}</h2><p>Your notification content here...</p>"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !templateKey || !name || !subject || !bodyHtml}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Create Template
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Send Test Email Modal ─────────────────────────────────
function SendTestModal({
  template,
  onClose,
}: {
  template: EmailTemplate
  onClose: () => void
}) {
  const [recipientEmail, setRecipientEmail] = useState("")
  const [variableValues, setVariableValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    for (const v of template.variables) {
      defaults[v] = `[test_${v}]`
    }
    return defaults
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      setResult({ success: false, message: "Recipient email is required" })
      return
    }

    setSending(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/email-templates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: template.template_key,
          to: recipientEmail.trim(),
          variables: variableValues,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ success: false, message: data.error || "Failed to send" })
      } else if (data.skipped) {
        setResult({ success: false, message: "Template is inactive — email was not sent" })
      } else {
        setResult({ success: true, message: data.message || "Test email sent!" })
      }
    } catch {
      setResult({ success: false, message: "Network error" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530] mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Send size={18} className="text-green-400" />
            Send Test Email
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Code size={12} />
            Template: <code className="bg-[#0B1120] px-2 py-0.5 rounded font-mono text-gray-400">{template.template_key}</code>
            {!template.is_active && (
              <span className="text-yellow-400 text-[10px] font-medium">(INACTIVE)</span>
            )}
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Recipient Email *</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
              placeholder="test@example.com"
            />
          </div>

          {template.variables.length > 0 && (
            <div>
              <label className="block mb-2 text-xs font-medium text-gray-400">
                Test Variable Values
              </label>
              <div className="space-y-2">
                {template.variables.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <code className="text-[10px] text-[#E8700A] bg-[#0B1120] px-1.5 py-1 rounded font-mono min-w-[120px]">
                      {`{{${v}}}`}
                    </code>
                    <input
                      type="text"
                      value={variableValues[v] || ""}
                      onChange={(e) =>
                        setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      className={`flex-1 px-2 py-1.5 rounded text-xs ${S.input}`}
                      placeholder={`Value for ${v}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div
              className={`px-3 py-2 rounded-lg text-xs border ${
                result.success
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {result.message}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Close
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !recipientEmail.trim()}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send size={14} />}
            Send Test
          </button>
        </div>
      </div>
    </div>
  )
}
