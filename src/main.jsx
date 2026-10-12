import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// /admin 경로의 레거시 관리 앱(src/Admin.jsx)은 로그인 없이 프로젝트 목록·삭제 API를 호출하던 화면이라
// 더 이상 노출하지 않는다. 관리 기능은 본 앱의 '설정'(관리자 역할)에서 제공한다.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
