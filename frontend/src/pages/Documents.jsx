import { useState, useEffect, useCallback } from 'react'
import { documentsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const CATEGORIES = ['blueprint', 'design', 'cad', 'photo', 'manual', 'contract', 'invoice', 'certificate', 'specification', 'other']

function Documents() {
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  const [documents, setDocuments] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  
  const itemsPerPage = 20
  
  const [form, setForm] = useState({
    name: '', description: '', category: 'other', file_path: '', file_type: '', linked_entity_type: '', linked_entity_id: '', tags: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (page - 1) * itemsPerPage, limit: itemsPerPage, is_archived: showArchived }
      if (category) params.category = category
      if (search) params.search = search
      const response = await documentsAPI.getAll(params)
      setDocuments(response.data.items || [])
      setTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load documents', err)
    } finally {
      setLoading(false)
    }
  }, [page, category, search, showArchived])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingDoc) {
        await documentsAPI.update(editingDoc.id, form)
        showAlert('Document updated')
      } else {
        await documentsAPI.create(form)
        showAlert('Document created')
      }
      setShowForm(false)
      setEditingDoc(null)
      loadDocuments()
    } catch (err) {
      showAlert('Failed to save document', 'error')
    }
  }

  const handleEdit = (doc) => {
    setEditingDoc(doc)
    setForm({
      name: doc.name, description: doc.description || '', category: doc.category || 'other',
      file_path: doc.file_path || '', file_type: doc.file_type || '',
      linked_entity_type: doc.linked_entity_type || '', linked_entity_id: doc.linked_entity_id || '', tags: doc.tags || ''
    })
    setShowForm(true)
  }

  const handleArchive = async (id, archive) => {
    try {
      if (archive) await documentsAPI.archive(id)
      else await documentsAPI.unarchive(id)
      showAlert(archive ? 'Document archived' : 'Document restored')
      loadDocuments()
    } catch (err) {
      showAlert('Failed to update document', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document permanently?')) return
    try {
      await documentsAPI.delete(id)
      showAlert('Document deleted')
      loadDocuments()
    } catch (err) {
      showAlert('Failed to delete document', 'error')
    }
  }

  const viewDetails = async (doc) => {
    try {
      const response = await documentsAPI.getById(doc.id)
      setSelectedDoc(response.data)
    } catch (err) {
      console.error('Failed to load document details', err)
    }
  }

  const resetForm = () => {
    setForm({ name: '', description: '', category: 'other', file_path: '', file_type: '', linked_entity_type: '', linked_entity_id: '', tags: '' })
  }

  if (loading && documents.length === 0) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          📂 Document Management
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingDoc(null); resetForm() }} className="btn btn-primary">+ New Document</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show Archived
        </label>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingDoc ? 'Edit Document' : 'New Document'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>File Path/URL</label>
                  <input type="text" value={form.file_path} onChange={(e) => setForm({ ...form, file_path: e.target.value })} placeholder="/uploads/file.pdf or https://..." />
                </div>
                <div className="form-group">
                  <label>File Type</label>
                  <input type="text" value={form.file_type} onChange={(e) => setForm({ ...form, file_type: e.target.value })} placeholder="pdf, dwg, jpg..." />
                </div>
                <div className="form-group">
                  <label>Link to Entity Type</label>
                  <select value={form.linked_entity_type} onChange={(e) => setForm({ ...form, linked_entity_type: e.target.value })}>
                    <option value="">None</option>
                    <option value="product">Product</option>
                    <option value="work_order">Work Order</option>
                    <option value="project">Project</option>
                    <option value="customer">Customer</option>
                    <option value="asset">Asset</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Entity ID</label>
                  <input type="number" value={form.linked_entity_id} onChange={(e) => setForm({ ...form, linked_entity_id: e.target.value })} placeholder="ID of linked entity" />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="2" />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="wood, table, v2..." />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingDoc ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedDoc.name}</h2>
            <p><strong>Document #:</strong> {selectedDoc.document_number}</p>
            <p><strong>Category:</strong> {selectedDoc.category}</p>
            <p><strong>File:</strong> {selectedDoc.file_path || 'No file attached'}</p>
            <p><strong>Version:</strong> {selectedDoc.current_version}</p>
            <p><strong>Description:</strong> {selectedDoc.description || '-'}</p>
            
            {selectedDoc.versions?.length > 0 && (
              <>
                <h4>Version History</h4>
                <ul>
                  {selectedDoc.versions.map(v => (
                    <li key={v.id}>v{v.version_number} - {new Date(v.created_at).toLocaleDateString()} {v.change_notes && `- ${v.change_notes}`}</li>
                  ))}
                </ul>
              </>
            )}
            
            <div className="form-actions">
              <button onClick={() => setSelectedDoc(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Doc #</th>
              <th>Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>Version</th>
              <th>Linked To</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map(doc => (
              <tr key={doc.id} style={{ opacity: doc.is_archived ? 0.6 : 1 }}>
                <td>{doc.document_number}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); viewDetails(doc) }} style={{ color: 'var(--green-400)' }}>{doc.name}</a></td>
                <td style={{ textTransform: 'capitalize' }}>{doc.category || '-'}</td>
                <td>{doc.file_type || '-'}</td>
                <td>v{doc.current_version}</td>
                <td>{doc.linked_entity_type ? `${doc.linked_entity_type} #${doc.linked_entity_id}` : '-'}</td>
                <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(doc)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleArchive(doc.id, !doc.is_archived)} className="btn-icon" title={doc.is_archived ? 'Restore' : 'Archive'}>{doc.is_archived ? '📤' : '📥'}</button>
                  <button onClick={() => handleDelete(doc.id)} className="btn-icon" title="Delete">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalItems={total} itemsPerPage={itemsPerPage} onPageChange={setPage} />
    </div>
  )
}

export default Documents
