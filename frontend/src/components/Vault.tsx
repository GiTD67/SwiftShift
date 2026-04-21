import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface Document {
  id: string
  name: string
  category: 'Paystubs' | 'Tax Forms' | 'Benefits' | 'Contracts' | 'Other'
  date: string
  type: string
  size: string
  icon: string
}

const MOCK_DOCUMENTS: Document[] = [
  { id: 'd1', name: 'Paystub - March 2026', category: 'Paystubs', date: '2026-03-31', type: 'PDF', size: '124 KB', icon: '💵' },
  { id: 'd2', name: 'Paystub - February 2026', category: 'Paystubs', date: '2026-02-28', type: 'PDF', size: '118 KB', icon: '💵' },
  { id: 'd3', name: 'Paystub - January 2026', category: 'Paystubs', date: '2026-01-31', type: 'PDF', size: '121 KB', icon: '💵' },
  { id: 'd4', name: 'W-2 2025', category: 'Tax Forms', date: '2026-01-31', type: 'PDF', size: '89 KB', icon: '📋' },
  { id: 'd5', name: '1099-MISC 2025', category: 'Tax Forms', date: '2026-01-31', type: 'PDF', size: '67 KB', icon: '📋' },
  { id: 'd6', name: 'Health Benefits Enrollment 2026', category: 'Benefits', date: '2025-12-15', type: 'PDF', size: '245 KB', icon: '🏥' },
  { id: 'd7', name: '401(k) Statement Q1 2026', category: 'Benefits', date: '2026-04-01', type: 'PDF', size: '156 KB', icon: '🏦' },
  { id: 'd8', name: 'Employment Offer Letter', category: 'Contracts', date: '2024-09-12', type: 'PDF', size: '312 KB', icon: '✍️' },
  { id: 'd9', name: 'NDA Agreement', category: 'Contracts', date: '2024-09-12', type: 'PDF', size: '78 KB', icon: '🔒' },
  { id: 'd10', name: 'Stock Options Grant 2025', category: 'Other', date: '2025-03-01', type: 'PDF', size: '134 KB', icon: '📈' },
]

const CATEGORIES = ['All', 'Paystubs', 'Tax Forms', 'Benefits', 'Contracts', 'Other'] as const

export function Vault() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('All')

  const filteredDocs = MOCK_DOCUMENTS.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'All' || doc.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const handleDownload = (doc: Document) => {
    toast.loading(`Downloading ${doc.name}...`, { id: doc.id })
    
    // Simulate download delay
    setTimeout(() => {
      toast.success(`Downloaded ${doc.name}`, {
        id: doc.id,
        description: `${doc.type} • ${doc.size}`,
        duration: 3000,
      })
    }, 600)
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(new Date(dateStr))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-[3px] text-white">DOCUMENTS</div>
          <div className="text-4xl font-semibold tracking-tight">The Vault</div>
          <div className="text-zinc-400 mt-1">All your important documents. One click away.</div>
        </div>
        
        <div className="text-right text-sm text-zinc-500">
          {filteredDocs.length} of {MOCK_DOCUMENTS.length} documents
        </div>
      </div>

      {/* Search + Filters */}
      <div className="glass rounded-3xl p-6 space-y-4">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input w-full px-5 py-3 rounded-2xl text-lg placeholder:text-zinc-500 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                activeCategory === cat
                  ? 'bg-white text-black font-medium'
                  : 'glass hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <div className="text-xl font-medium mb-2">No documents found</div>
          <div className="text-zinc-500">Try a different search or category</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredDocs.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="glass rounded-3xl p-5 flex items-center gap-5 group"
            >
              <div className="text-4xl flex-shrink-0">{doc.icon}</div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-lg truncate">{doc.name}</div>
                <div className="flex items-center gap-3 text-sm text-zinc-500 mt-0.5">
                  <span>{formatDate(doc.date)}</span>
                  <span>•</span>
                  <span>{doc.category}</span>
                  <span>•</span>
                  <span>{doc.type} • {doc.size}</span>
                </div>
              </div>

              <button
                onClick={() => handleDownload(doc)}
                className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white text-white hover:text-black font-medium transition flex items-center gap-2 text-sm"
              >
                <span>↓</span>
                <span>Download</span>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div className="text-center text-xs text-zinc-500 pt-4">
        💾 Documents are securely stored. Downloads are instant.
      </div>
    </div>
  )
}
