#include <stdio.h>

int assign(int* a)
{
  return *a;  /* dereference a */
}

int main() {
  int *a=NULL, b;
  b = assign(a);  /* call assign with NULL pointer
                     dereference a in assign is a
                     Null-Pointer-Dereference issue */
  printf("value of b = %d\n", b);
  return 0;
}

