import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'

// Librerías para el reordenamiento (Drag & Drop)
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: CADA CANCIÓN EN EL PLAN DEL CULTO ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  
  // Estado de transporte local para esta canción específica
  const [misSemitonos, setMisSemitonos] = useState(0);
  const estaAbierta = cancionAbierta === c.id;

  const transponerIndividual = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
    marginBottom: '10px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#111',
    overflow: 'hidden'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.acordeonHeaderActivo : estilos.acordeonHeader} 
        onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}
      >
        <div style={estilos.tituloAcordeon}>
          <span {...attributes} {...listeners} style={estilos.dragHandle}>☰</span>
          <span style={{color: '#4da6ff', marginRight: '10px'}}>{estaAbierta ? '▼' : '▶'}</span>
          {c.titulo}
          <span style={estilos.badgeTono}>
            {transponerIndividual(c.tono, misSemitonos)}
          </span>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <div style={estilos.miniTransporte} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnXSmall}>-</button>
                <span style={{fontSize: '0.7rem', minWidth: '15px', textAlign: 'center'}}>{misSemitonos}</span>
                <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnXSmall}>+</button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); quitarDelSetlist(c.id); }} style={estilos.btnQuitar}>×</button>
        </div>
      </div>

      {estaAbierta && (
        <div style={estilos.acordeonContent}>
          <pre style={estilos.letra}>{transponerIndividual(c.letra, misSemitonos)}</pre>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [canciones, setCanciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cancionAbierta, setCancionAbierta] = useState(null)
  
  // Guardamos la lista en el navegador para que aparezca en el celular
  const [setlist, setSetlist] = useState(() => {
    const guardado = localStorage.getItem('setlist_domingo')
    return guardado ? JSON.parse(guardado) : []
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    localStorage.setItem('setlist_domingo', JSON.stringify(setlist))
  }, [setlist])

  useEffect(() => {
    const traerCanciones = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true })
      if (data) {
        // Asignamos IDs únicos reales para que no se seleccionen todas juntas
        const cancionesConId = data.map((c, index) => ({
          ...c,
          id: c.id || `id-${index}-${c.titulo.substring(0,3)}`
        }))
        setCanciones(cancionesConId)
      }
    }
    traerCanciones()
  }, [])

  const agregarAlSetlist = (cancion) => {
    if (!setlist.some(item => item.id === cancion.id)) {
      setSetlist(prev => [...prev, cancion]);
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const cancionesFiltradas = canciones.filter(c => 
    c.titulo.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={estilos.pantalla}>
      <header style={estilos.header}>
        <h1 style={estilos.logo}>🎸 Odre Nuevo</h1>
        <input 
            type="text" 
            placeholder="🔍 Buscar canción..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={estilos.buscador}
        />
      </header>

      <section style={{maxWidth: '800px', margin: '0 auto'}}>
        <h2 style={estilos.subtitulo}>📅 PLAN DEL CULTO ({setlist.length})</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map((c) => (
              <ItemSortable 
                key={`setlist-${c.id}`} 
                c={c} 
                cancionAbierta={cancionAbierta} 
                setCancionAbierta={setCancionAbierta}
                quitarDelSetlist={(id) => setSetlist(setlist.filter(item => item.id !== id))}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div style={estilos.divisor}>REPERTORIO GENERAL</div>

        <div style={estilos.grid}>
          {cancionesFiltradas.map((c) => {
            const yaEsta = setlist.some(item => item.id === c.id);
            return (
              <div key={`repo-${c.id}`} style={yaEsta ? estilos.itemRepoElegido : estilos.itemRepo}>
                <span>{c.titulo}</span>
                <button 
                  onClick={() => agregarAlSetlist(c)} 
                  style={yaEsta ? estilos.btnCheck : estilos.btnPlus}
                  disabled={yaEsta}
                >
                  {yaEsta ? '✓' : '+'}
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const estilos = {
  pantalla: { backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' },
  header: { marginBottom: '30px', borderBottom: '1px solid #222', paddingBottom: '15px' },
  logo: { color: '#4da6ff', margin: '0 0 15px 0' },
  buscador: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: '#fff', boxSizing: 'border-box' },
  subtitulo: { color: '#888', fontSize: '0.8rem', marginBottom: '15px' },
  acordeonHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#161616', cursor: 'pointer' },
  acordeonHeaderActivo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#1a3a5a', cursor: 'pointer' },
  tituloAcordeon: { fontWeight: 'bold', display: 'flex', alignItems: 'center', fontSize: '0.9rem' },
  dragHandle: { marginRight: '15px', color: '#555', cursor: 'grab' },
  badgeTono: { color: '#4da6ff', marginLeft: '10px', background: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' },
  acordeonContent: { padding: '20px', background: '#050505', borderTop: '1px solid #222' },
  letra: { whiteSpace: 'pre-wrap', fontSize: '1.2rem', lineHeight: '1.6', fontFamily: 'monospace', color: '#ccc' },
  btnQuitar: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.2rem', cursor: 'pointer' },
  miniTransporte: { display: 'flex', alignItems: 'center', gap: '5px', background: '#000', padding: '3px 8px', borderRadius: '20px', border: '1px solid #333' },
  btnXSmall: { background: 'none', border: 'none', color: '#4da6ff', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' },
  divisor: { textAlign: 'center', color: '#444', margin: '40px 0 20px 0', fontSize: '0.7rem', letterSpacing: '2px' },
  grid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#1a1a1a', borderRadius: '8px' },
  itemRepoElegido: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0d1a26', borderRadius: '8px', opacity: 0.5 },
  btnPlus: { background: '#4da6ff', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' },
  btnCheck: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '1.2rem' }
}