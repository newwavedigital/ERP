import React, { useEffect, useState } from 'react'
import { Shield, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import UserApprovals from './UserApprovals'
import ToolPermissions from '../ToolPermissions'

const AccountManagement: React.FC = () => {
  const location = useLocation()
  const isPermissions = (location.pathname || '').endsWith('/permissions')
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>(isPermissions ? 'permissions' : 'users')

  useEffect(() => {
    const next = isPermissions ? 'permissions' : 'users'
    setActiveTab(next)
  }, [isPermissions])

  return (
    <div className="p-2 sm:p-4 lg:p-6">
      <div className="bg-white rounded-xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-dark mb-1">Account Management</h1>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-neutral-soft/20 p-3 sm:p-4 lg:p-6 mb-3 lg:mb-4">
        <nav className="-mb-px flex gap-3 sm:gap-6 overflow-x-auto">
          <Link
            to="/admin/management/users"
            className={`${activeTab === 'users' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} inline-flex items-center gap-2 border-b-2 px-2 py-2 text-sm font-semibold whitespace-nowrap`}
          >
            <Users className="h-4 w-4" /> Users
          </Link>
          <Link
            to="/admin/management/permissions"
            className={`${activeTab === 'permissions' ? 'border-primary-medium text-primary-medium' : 'border-transparent text-neutral-medium hover:text-neutral-dark'} inline-flex items-center gap-2 border-b-2 px-2 py-2 text-sm font-semibold whitespace-nowrap`}
          >
            <Shield className="h-4 w-4" /> Permissions
          </Link>
        </nav>
      </div>

      {activeTab === 'users' ? (
        <UserApprovals embedded />
      ) : (
        <ToolPermissions embedded />
      )}
    </div>
  )
}

export default AccountManagement
