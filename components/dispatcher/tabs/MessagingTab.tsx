"use client"

import { useState, useEffect, useRef } from "react"
import { LoadWithRelations, LoadMessage } from "@/types/dispatcher"

type MessagingTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

export function MessagingTab({ load, onUpdate }: MessagingTabProps) {
  const [messages, setMessages] = useState<LoadMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentUser = "System" // In a real app, this would come from auth context

  useEffect(() => {
    fetchMessages()
  }, [load.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(Array.isArray(data) ? data : data.messages || [])
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newMessage,
          sender_name: currentUser,
        }),
      })
      if (response.ok) {
        setNewMessage("")
        await fetchMessages()
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-400">Loading messages...</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No messages yet. Start a conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = msg.sender_name === currentUser
            return (
              <div
                key={msg.id}
                className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                    isCurrentUser
                      ? "bg-[#E8700A] text-white rounded-br-none"
                      : "bg-[#1F2937] text-gray-300 rounded-bl-none border border-white/10"
                  }`}
                >
                  {!isCurrentUser && (
                    <div className="text-xs font-semibold text-gray-400 mb-1">
                      {msg.sender_name || "Unknown"}
                    </div>
                  )}
                  <div className="text-sm break-words">{msg.message}</div>
                  <div className={`text-xs mt-1 ${isCurrentUser ? "text-white/70" : "text-gray-500"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="border-t border-white/5 pt-4 mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            className="px-4 py-2 rounded-lg bg-[#E8700A] text-white text-sm font-medium hover:bg-[#FF8C21] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  )
}
