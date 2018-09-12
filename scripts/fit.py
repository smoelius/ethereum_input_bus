#!/usr/bin/env python
#======================================================================================================#
# fit.py
#======================================================================================================#

import numpy as np
import sys

M = np.loadtxt(sys.stdin, delimiter="\t")

ind = np.lexsort((M[:,2], M[:,1], M[:,0]))

M = np.asmatrix([(M[i,0], M[i,1], M[i,2]) for i in ind])

i = 0
while i + 1 < M.shape[0]:
  if M[i,0] == M[i + 1,0] and M[i,1] == M[i + 1,1] and M[i,2] <= M[i + 1,2]:
    M = np.delete(M, i, axis=0)
  else:
    i += 1

print "filtered input:"
print M

#======================================================================================================#
# smoelius: The remainder of this file is based on code by Ben Axelrod:
#   Best Fitting Plane given a Set of Points
#   https://math.stackexchange.com/a/2306029
#======================================================================================================#

import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
# import numpy as np

xs = M[:,0]
ys = M[:,1]
zs = M[:,2]

# plot raw data
plt.figure()
ax = plt.subplot(111, projection='3d')
ax.scatter(xs, ys, zs, color='b')

# do fit
A = np.concatenate([M[:,:2], np.asmatrix(np.ones(M.shape[0])).T], axis=1)
b = M[:,2:]
fit = (A.T * A).I * A.T * b
errors = b - A * fit
residual = np.linalg.norm(errors)

print "solution:"
print "%f x + %f y + %f = z" % (fit[0], fit[1], fit[2])
print "errors:"
print errors
print "residual:"
print residual

# plot plane
xlim = ax.get_xlim()
ylim = ax.get_ylim()
X,Y = np.meshgrid(np.arange(xlim[0], xlim[1]),
                  np.arange(ylim[0], ylim[1]))
Z = np.zeros(X.shape)
for r in range(X.shape[0]):
    for c in range(X.shape[1]):
        Z[r,c] = fit[0] * X[r,c] + fit[1] * Y[r,c] + fit[2]
ax.plot_wireframe(X,Y,Z, color='k')

ax.set_xlabel('x')
ax.set_ylabel('y')
ax.set_zlabel('z')
plt.show()

#======================================================================================================#
