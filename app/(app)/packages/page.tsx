"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Edit, Plus, Package, Search, Package2, CirclePlus } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"

function formatCurrency(amount: number, currency: string) {
  try {
    const localeMap: Record<string, string> = {
      USD: "en-US",
      ZAR: "en-ZA",
      EUR: "de-DE",
      GBP: "en-GB",
      CAD: "en-CA",
      AUD: "en-AU",
    }

    const locale = localeMap[currency] || "en-US"
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount || 0)
  } catch {
    const symbolMap: Record<string, string> = {
      USD: "$",
      ZAR: "R",
      EUR: "€",
      GBP: "£",
      CAD: "$",
      AUD: "$",
    }
    const symbol = symbolMap[currency] || currency
    return `${symbol}${Number(amount || 0).toFixed(2)}`
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sgbrlqcquoydwgugaiqn.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnYnJscWNxdW95ZHdndWdhaXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODg4NjksImV4cCI6MjA3Mzg2NDg2OX0.QdfVq-AWsAoufIWe0d4OyursigMHYcerrqVezp7LhKs"

interface Item {
  id: string
  description: string
  unit_price: number
  qty: number
  taxable: boolean
  item_type: string
  unit: string
}

interface PackageWithItems {
  id: string
  name: string
  description: string | null
  price_excl_vat: number
  price_incl_vat: number
  currency: string
  items: Item[]
  created_at: string
  updated_at: string
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageWithItems[]>([])
  const [availableItems, setAvailableItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<PackageWithItems | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [itemSearch, setItemSearch] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [newItemData, setNewItemData] = useState({
    description: "",
    unit_price: "",
    qty: "1",
    taxable: true,
    item_type: "fixed",
    unit: "each",
  })

  const [selectedCurrency, setSelectedCurrency] = useState("USD")

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const fetchPackages = useCallback(async (): Promise<PackageWithItems[]> => {
    const { data, error } = await supabase
      .from("packages")
      .select("*, package_items(items(*))")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching packages:", error)
      return []
    }

    return data?.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price_excl_vat: pkg.price_excl_vat,
      price_incl_vat: pkg.price_incl_vat,
      currency: pkg.currency || "USD",
      items: pkg.package_items?.map((pi: { items: Item }) => pi.items) || [],
      created_at: pkg.created_at,
      updated_at: pkg.updated_at,
    })) || []
  }, [supabase])

  const fetchItems = useCallback(async (): Promise<Item[]> => {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("description")

    if (error) {
      console.error("Error fetching items:", error)
      return []
    }
    return data || []
  }, [supabase])

  const loadData = useCallback(async () => {
    try {
      const [packagesData, itemsData] = await Promise.all([
        fetchPackages(),
        fetchItems()
      ])
      setPackages(packagesData)
      setAvailableItems(itemsData)
    } catch (error) {
      console.error("Failed to load data:", error)
      toast.error("Failed to load data")
    }
    setLoading(false)
  }, [fetchItems, fetchPackages])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredItems = availableItems.filter(item =>
    item.description.toLowerCase().includes(itemSearch.toLowerCase()) &&
    !selectedItems.includes(item.id)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedItems.length === 0) {
      toast.error("Please select at least one item for the package")
      return
    }

    const packageData = {
      name: formData.name,
      description: formData.description || null,
      price_excl_vat: calculateTotals(selectedItems).subtotalExclVat,
      price_incl_vat: calculateTotals(selectedItems).totalInclVat,
      currency: selectedCurrency,
    }

    try {
      if (editingPackage) {
        // Update package
        const { data: updatedPackage, error: updateError } = await supabase
          .from("packages")
          .update(packageData)
          .eq("id", editingPackage.id)
          .select()
          .single()

        if (updateError) throw updateError

        // Remove existing package items
        await supabase
          .from("package_items")
          .delete()
          .eq("package_id", editingPackage.id)

        // Add new package items
        const packageItems = selectedItems.map(itemId => ({
          package_id: updatedPackage.id,
          item_id: itemId
        }))

        await supabase
          .from("package_items")
          .insert(packageItems)

        toast.success("Package updated successfully")
      } else {
        // Create new package
        const { data: newPackage, error: insertError } = await supabase
          .from("packages")
          .insert(packageData)
          .select()
          .single()

        if (insertError) throw insertError

        // Add package items
        const packageItems = selectedItems.map(itemId => ({
          package_id: newPackage.id,
          item_id: itemId
        }))

        await supabase
          .from("package_items")
          .insert(packageItems)

        toast.success("Package created successfully")
      }

      setFormData({ name: "", description: "" })
      setSelectedCurrency("USD")
      setSelectedItems([])
      setEditingPackage(null)
      setOpen(false)
      loadData()
    } catch (error) {
      console.error("Error saving package:", error)
      toast.error("Failed to save package")
    }
  }

  const handleEdit = (pkg: PackageWithItems) => {
    setEditingPackage(pkg)
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
    })
    setSelectedCurrency(pkg.currency || "USD")
    setSelectedItems(pkg.items.map(item => item.id))
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      // Remove package items first
      await supabase
        .from("package_items")
        .delete()
        .eq("package_id", id)

      // Then delete package
      await supabase
        .from("packages")
        .delete()
        .eq("id", id)

      toast.success("Package deleted successfully")
      loadData()
    } catch (error) {
      console.error("Error deleting package:", error)
      toast.error("Failed to delete package")
    }
  }

  const addItemToPackage = (itemId: string) => {
    setSelectedItems(prev => [...prev, itemId])
    setItemSearch("")
  }

  const removeItemFromPackage = (itemId: string) => {
    setSelectedItems(prev => prev.filter(id => id !== itemId))
  }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()

    const itemData = {
      description: newItemData.description,
      unit_price: parseFloat(newItemData.unit_price),
      qty: parseInt(newItemData.qty),
      taxable: newItemData.taxable,
      item_type: newItemData.item_type,
      unit: newItemData.unit,
    }

    try {
      const { data, error } = await supabase
        .from("items")
        .insert(itemData)
        .select()
        .single()

      if (error) throw error

      // Add the newly created item to the selected items
      setSelectedItems(prev => [...prev, data.id])

      // Reset form and close dialog
      setNewItemData({
        description: "",
        unit_price: "",
        qty: "1",
        taxable: true,
        item_type: "fixed",
        unit: "each",
      })
      setItemDialogOpen(false)

      // Refresh items list
      const updatedItems = await fetchItems()
      setAvailableItems(updatedItems)

      toast.success("Item created and added to package")
    } catch (error) {
      console.error("Error creating item:", error)
      toast.error("Failed to create item")
    }
  }

  const calculateTotals = (itemIds: string[]) => {
    const items = availableItems.filter(item => itemIds.includes(item.id))
    const subtotalExclVat = items.reduce((acc, item) => acc + item.unit_price * item.qty, 0)
    const taxableAmount = items.filter(i => i.taxable).reduce((acc, item) => acc + item.unit_price * item.qty, 0)
    const vatPercentage = 15 // Default VAT percentage
    const vatAmount = taxableAmount * (vatPercentage / 100)
    const totalInclVat = subtotalExclVat + vatAmount

    return {
      subtotalExclVat,
      vatAmount,
      totalInclVat,
      itemCount: items.length
    }
  }

  const selectedItemsData = availableItems.filter(item => selectedItems.includes(item.id))
  const totals = calculateTotals(selectedItems)

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packages</h1>
          <p className="text-muted-foreground">
            Manage your service packages with multiple items
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPackage(null)}>
              <Plus className="mr-2 h-4 w-4" />
              New Package
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingPackage ? "Edit Package" : "Create New Package"}
                </DialogTitle>
                <DialogDescription>
                  {editingPackage
                    ? "Update the package and its items."
                    : "Create a new package by selecting items to include."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {/* Package Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="name">Package Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency *</Label>
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">🇺🇸 USD ($)</SelectItem>
                        <SelectItem value="ZAR">🇿🇦 ZAR (R)</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR (€)</SelectItem>
                        <SelectItem value="GBP">🇬🇧 GBP (£)</SelectItem>
                        <SelectItem value="CAD">🇨🇦 CAD ($)</SelectItem>
                        <SelectItem value="AUD">🇦🇺 AUD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Item Selection */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-base font-medium">Package Items</Label>
                    <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <CirclePlus className="h-4 w-4 mr-2" />
                          Create New Item
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <form onSubmit={handleCreateItem}>
                          <DialogHeader>
                            <DialogTitle>Create New Item</DialogTitle>
                            <DialogDescription>
                              Create a new item and automatically add it to this package
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="description" className="text-right">
                                Description *
                              </Label>
                              <Input
                                id="description"
                                value={newItemData.description}
                                onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                                className="col-span-3"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="unit_price" className="text-right">
                                Unit Price *
                              </Label>
                              <Input
                                id="unit_price"
                                type="number"
                                step="0.01"
                                value={newItemData.unit_price}
                                onChange={(e) => setNewItemData({ ...newItemData, unit_price: e.target.value })}
                                className="col-span-3"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="qty" className="text-right">
                                Quantity *
                              </Label>
                              <Input
                                id="qty"
                                type="number"
                                min="1"
                                value={newItemData.qty}
                                onChange={(e) => setNewItemData({ ...newItemData, qty: e.target.value })}
                                className="col-span-3"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="unit" className="text-right">
                                Unit *
                              </Label>
                              <Input
                                id="unit"
                                value={newItemData.unit}
                                onChange={(e) => setNewItemData({ ...newItemData, unit: e.target.value })}
                                className="col-span-3"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="item_type" className="text-right">
                                Type *
                              </Label>
                              <Select
                                value={newItemData.item_type}
                                onValueChange={(value) => setNewItemData({ ...newItemData, item_type: value })}
                              >
                                <SelectTrigger className="col-span-3">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed</SelectItem>
                                  <SelectItem value="hourly">Hourly</SelectItem>
                                  <SelectItem value="expense">Expense</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="taxable" className="text-right">
                                Taxable
                              </Label>
                              <div className="flex items-center space-x-2 col-span-3">
                                <input
                                  id="taxable"
                                  type="checkbox"
                                  checked={newItemData.taxable}
                                  onChange={(e) => setNewItemData({ ...newItemData, taxable: e.target.checked })}
                                  className="rounded"
                                />
                                <Label htmlFor="taxable" className="text-sm">
                                  This item is taxable
                                </Label>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit">Create Item & Add to Package</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items to add..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {itemSearch && filteredItems.length > 0 && (
                    <Card className="mt-2">
                      <CardContent className="p-0">
                        <div className="max-h-48 overflow-y-auto">
                          {filteredItems.map(item => (
                            <div
                              key={item.id}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                              onClick={() => addItemToPackage(item.id)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{item.description}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {item.qty} {item.unit} × ${(item.unit_price).toFixed(2)}
                                  </p>
                                </div>
                                <Button type="button" variant="ghost" size="sm">
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Selected Items */}
                {selectedItemsData.length > 0 && (
                  <div>
                    <Label className="text-base font-medium">Selected Items ({selectedItemsData.length})</Label>
                    <Card className="mt-2">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Taxable</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItemsData.map(item => (
                              <TableRow key={item.id}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.qty} {item.unit}</TableCell>
                                <TableCell>{formatCurrency(item.unit_price, selectedCurrency)}</TableCell>
                                <TableCell>{formatCurrency(item.unit_price * item.qty, selectedCurrency)}</TableCell>
                                <TableCell>{item.taxable ? "Yes" : "No"}</TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItemFromPackage(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Package Totals */}
                {selectedItemsData.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm font-medium">Items</p>
                          <p className="text-2xl font-bold">{totals.itemCount}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Subtotal (Excl VAT)</p>
                          <p className="text-2xl font-bold">{formatCurrency(totals.subtotalExclVat, selectedCurrency)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">VAT (15%)</p>
                          <p className="text-2xl font-bold">{formatCurrency(totals.vatAmount, selectedCurrency)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Total (Incl VAT)</p>
                          <p className="text-2xl font-bold text-primary">{formatCurrency(totals.totalInclVat, selectedCurrency)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={selectedItems.length === 0}>
                  {editingPackage ? "Update Package" : "Create Package"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {packages.map((pkg) => (
          <Card key={pkg.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package2 className="h-5 w-5" />
                  {pkg.name}
                </CardTitle>
                <CardDescription>{pkg.description || "No description"}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(pkg)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(pkg.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {pkg.items.length} items
                  </Badge>
                  <Badge variant="outline">
                    {formatCurrency(pkg.price_excl_vat, pkg.currency)} excl VAT
                  </Badge>
                  <Badge variant="default">
                    {formatCurrency(pkg.price_incl_vat, pkg.currency)} incl VAT
                  </Badge>
                </div>

                {pkg.items.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Package Items:</p>
                    <div className="space-y-1">
                      {pkg.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded">
                          <span>{item.description}</span>
                          <span>{formatCurrency(item.unit_price * item.qty, pkg.currency)} ({item.qty} {item.unit})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {packages.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No packages yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first package by combining multiple items
              </p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Package
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}