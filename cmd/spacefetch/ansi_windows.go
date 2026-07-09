//go:build windows

package main

import (
	"os"
	"syscall"
	"unsafe"
)

func enableANSI() {
	k32 := syscall.NewLazyDLL("kernel32.dll")
	getMode := k32.NewProc("GetConsoleMode")
	setMode := k32.NewProc("SetConsoleMode")
	h := syscall.Handle(os.Stdout.Fd())
	var mode uint32
	if r, _, _ := getMode.Call(uintptr(h), uintptr(unsafe.Pointer(&mode))); r != 0 {
		const enableVT = 0x0004
		setMode.Call(uintptr(h), uintptr(mode|enableVT))
	}
}
