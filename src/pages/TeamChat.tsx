import React, { useState } from 'react'
import { Send, Search, MessageCircle, Users, Hash, Plus } from 'lucide-react'

const TeamChat: React.FC = () => {
  const [message, setMessage] = useState<string>('')
  const [activeChannel, setActiveChannel] = useState<string>('general')

  const handleSendMessage = (): void => {
    if (message.trim()) {
      console.log('Sending message:', message)
      setMessage('')
    }
  }

  const channels = [
    { id: 'general', name: 'General', unread: 0, active: true },
    { id: 'production', name: 'Production Team', unread: 3, active: false },
    { id: 'quality', name: 'Quality Control', unread: 0, active: false },
    { id: 'logistics', name: 'Logistics', unread: 1, active: false },
  ]

  const messages = [
    {
      id: 1,
      user: 'Sarah Johnson',
      avatar: 'SJ',
      time: '09:00 AM',
      message: 'Good morning everyone! Ready for another productive day.',
      color: 'bg-primary-medium'
    },
    {
      id: 2,
      user: 'Mike Chen',
      avatar: 'MC',
      time: '09:15 AM',
      message: 'Morning! Just finished the quality check on batch #247. All looks good.',
      color: 'bg-accent-success'
    },
    {
      id: 3,
      user: 'Lisa Rodriguez',
      avatar: 'LR',
      time: '09:30 AM',
      message: 'Great work team! The new packaging design samples arrived. They look fantastic.',
      color: 'bg-accent-warning'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-light/30 to-neutral-soft/20">
      <div className="p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-dark mb-2">Team Chat</h1>
              <p className="text-neutral-medium text-lg">Communicate with your team in real-time</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-4 py-2 bg-accent-success/10 rounded-xl border border-accent-success/20">
                <div className="w-2 h-2 bg-accent-success rounded-full"></div>
                <span className="text-sm font-semibold text-accent-success">5 Online</span>
              </div>
              <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center">
                <Plus className="h-5 w-5 mr-3" />
                New Channel
              </button>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-3xl shadow-md border border-neutral-soft/30 overflow-hidden h-[calc(100vh-280px)]">
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-80 border-r border-neutral-soft/30 flex flex-col bg-gradient-to-b from-neutral-light/20 to-neutral-light/5">
              {/* Search */}
              <div className="p-6 border-b border-neutral-soft/30">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-medium" />
                  <input
                    type="text"
                    placeholder="Search messages..."
                    className="w-full pl-12 pr-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium"
                  />
                </div>
              </div>

              {/* Channels */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-neutral-dark uppercase tracking-wider">Channels</h3>
                  <MessageCircle className="h-4 w-4 text-primary-medium" />
                </div>
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setActiveChannel(channel.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-all duration-200 ${
                        activeChannel === channel.id
                          ? 'bg-gradient-to-r from-primary-light/20 to-primary-medium/10 text-primary-dark border border-primary-light/30 shadow-sm'
                          : 'text-neutral-dark hover:bg-neutral-light/60 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Hash className="h-4 w-4" />
                        <span className="font-medium">{channel.name}</span>
                      </div>
                      {channel.unread > 0 && (
                        <span className="bg-accent-danger text-white text-xs rounded-full px-2 py-1 min-w-[20px] h-5 flex items-center justify-center font-semibold">
                          {channel.unread}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Online Members */}
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-neutral-dark uppercase tracking-wider">Online</h3>
                    <Users className="h-4 w-4 text-primary-medium" />
                  </div>
                  <div className="space-y-3">
                    {['Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez', 'John Doe', 'Emma Wilson'].map((name, index) => (
                      <div key={name} className="flex items-center space-x-3">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
                            ['bg-primary-medium', 'bg-accent-success', 'bg-accent-warning', 'bg-primary-dark', 'bg-neutral-medium'][index]
                          }`}>
                            {name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-success rounded-full border-2 border-white"></div>
                        </div>
                        <span className="text-sm font-medium text-neutral-dark">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {/* Chat Header */}
              <div className="px-8 py-6 border-b border-neutral-soft/30 bg-gradient-to-r from-primary-dark/5 via-primary-medium/5 to-primary-light/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-medium/20 to-primary-medium/10 rounded-xl flex items-center justify-center">
                      <Hash className="h-5 w-5 text-primary-medium" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-neutral-dark">General</h2>
                      <p className="text-sm text-neutral-medium">Manufacturing Team</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="px-3 py-1.5 bg-primary-light/10 rounded-xl border border-primary-light/20">
                      <span className="text-sm font-semibold text-primary-dark">5 members</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex space-x-4 group">
                    <div className={`w-10 h-10 ${msg.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <span className="text-white text-sm font-semibold">{msg.avatar}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-bold text-neutral-dark">{msg.user}</span>
                        <span className="text-xs text-neutral-medium bg-neutral-light/60 px-2 py-1 rounded-lg">{msg.time}</span>
                      </div>
                      <div className="bg-gradient-to-br from-neutral-light/40 to-neutral-light/20 rounded-2xl rounded-tl-md p-4 border border-neutral-soft/30 group-hover:shadow-sm transition-all duration-200">
                        <p className="text-sm text-neutral-dark leading-relaxed">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-6 border-t border-neutral-soft/30 bg-gradient-to-r from-neutral-light/20 to-neutral-light/5">
                <div className="flex items-end space-x-4">
                  <div className="flex-1">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                      placeholder="Message #general..."
                      rows={1}
                      className="w-full px-4 py-3 border border-neutral-soft rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary-light transition-all duration-200 bg-white text-neutral-dark placeholder-neutral-medium shadow-sm hover:shadow-md hover:border-neutral-medium resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="p-3 rounded-xl bg-gradient-to-r from-primary-dark to-primary-medium hover:from-primary-medium hover:to-primary-light text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamChat
